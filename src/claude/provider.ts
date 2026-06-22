import { spawn, type ChildProcess } from 'node:child_process';
import { writeFileSync, unlinkSync, mkdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { createInterface } from 'node:readline';
import { logger } from '../logger.js';

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export interface QueryOptions {
  prompt: string;
  cwd: string;
  resume?: string;
  model?: string;
  systemPrompt?: string;
  images?: Array<{
    type: "image";
    source: { type: "base64"; media_type: string; data: string };
  }>;
  /** Called when Codex produces an assistant message. */
  onText?: (text: string) => Promise<void> | void;
  /** Called when an assistant turn ends. Codex emits final messages, so this is normally end_turn. */
  onTurnEnd?: (stopReason: string) => Promise<void> | void;
  /** Optional abort controller to cancel the query (e.g. when user sends a new message). */
  abortController?: AbortController;
}

export interface QueryResult {
  text: string;
  sessionId: string;
  error?: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const TEMP_DIR = join(tmpdir(), 'wechat-codex');

function saveImageTemp(images: NonNullable<QueryOptions['images']>): string[] {
  mkdirSync(TEMP_DIR, { recursive: true });
  const paths: string[] = [];
  for (const img of images) {
    const ext = img.source.media_type.split('/')[1] || 'png';
    const fileName = `img-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
    const filePath = join(TEMP_DIR, fileName);
    writeFileSync(filePath, Buffer.from(img.source.data, 'base64'));
    paths.push(filePath);
  }
  return paths;
}

function cleanupTempFiles(paths: string[]): void {
  for (const p of paths) {
    try { unlinkSync(p); } catch { /* ignore */ }
  }
}

function buildPrompt(prompt: string, systemPrompt?: string): string {
  return [
    systemPrompt ? `<system>\n${systemPrompt}\n</system>` : '',
    prompt,
  ].filter(Boolean).join('\n\n');
}

function resolveCodexBin(): string {
  if (process.env.CODEX_BIN) return process.env.CODEX_BIN;
  const macAppBin = '/Applications/Codex.app/Contents/Resources/codex';
  if (existsSync(macAppBin)) return macAppBin;
  return 'codex';
}

// ---------------------------------------------------------------------------
// Stream parser (extracted for testability)
// ---------------------------------------------------------------------------

export interface StreamParserState {
  sessionId: string;
  textParts: string[];
  errorMessage?: string;
}

export interface StreamParserCallbacks {
  onText?: (text: string) => void;
  onTurnEnd?: (stopReason: string) => void;
}

export function handleStreamLine(
  line: string,
  state: StreamParserState,
  callbacks: StreamParserCallbacks,
): void {
  if (!line.trim()) return;

  let obj: any;
  try {
    obj = JSON.parse(line);
  } catch {
    // Codex can print warnings alongside JSONL. Keep the bridge tolerant.
    return;
  }

  switch (obj.type) {
    case 'thread.started': {
      if (obj.thread_id) {
        state.sessionId = obj.thread_id;
      }
      break;
    }
    case 'item.completed': {
      const item = obj.item;
      if (item?.type === 'agent_message' && typeof item.text === 'string' && item.text.trim()) {
        state.textParts.push(item.text);
        if (callbacks.onText) Promise.resolve(callbacks.onText(item.text)).catch(() => {});
        if (callbacks.onTurnEnd) Promise.resolve(callbacks.onTurnEnd('end_turn')).catch(() => {});
      }
      break;
    }
    case 'turn.failed':
    case 'error': {
      state.errorMessage = obj.message || obj.error || obj.reason || 'Codex returned an error.';
      logger.error('Codex CLI returned error event', { event: obj });
      break;
    }
    default:
      break;
  }
}

// ---------------------------------------------------------------------------
// Core function
// ---------------------------------------------------------------------------

export async function codexQuery(options: QueryOptions): Promise<QueryResult> {
  const {
    prompt,
    cwd,
    resume,
    model,
    systemPrompt,
    images,
    onText,
    onTurnEnd,
    abortController,
  } = options;

  logger.info("Starting Codex CLI query", {
    cwd,
    model,
    resume: !!resume,
    hasImages: !!images?.length,
  });

  const tempImagePaths = images?.length ? saveImageTemp(images) : [];

  const args: string[] = ['exec'];
  if (resume) args.push('resume');
  args.push('--json', '--dangerously-bypass-approvals-and-sandbox');
  if (model) args.push('--model', model);
  for (const p of tempImagePaths) {
    args.push('--image', p);
  }
  if (resume) {
    args.push(resume, '-');
  } else {
    args.push('--cd', cwd, '-');
  }

  const fullPrompt = buildPrompt(prompt, systemPrompt);

  let child: ChildProcess | undefined;
  let settled = false;

  const QUERY_TIMEOUT_MS = 60 * 60 * 1000;

  return new Promise<QueryResult>((resolve) => {
    const finish = (result: QueryResult) => {
      if (settled) return;
      settled = true;
      cleanupTempFiles(tempImagePaths);
      resolve(result);
    };

    try {
      child = spawn(resolveCodexBin(), args, {
        cwd,
        stdio: ['pipe', 'pipe', 'pipe'],
        env: { ...process.env },
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      finish({ text: '', sessionId: '', error: `Failed to spawn codex: ${msg}` });
      return;
    }

    child.stdin!.write(fullPrompt);
    child.stdin!.end();

    const parserState: StreamParserState = {
      sessionId: '',
      textParts: [],
    };
    const parserCallbacks: StreamParserCallbacks = { onText, onTurnEnd };

    const timeoutId = setTimeout(() => {
      logger.warn('Codex CLI query timed out, killing process');
      child!.kill('SIGTERM');
      const partialText = parserState.textParts.join('\n').trim();
      finish({
        text: partialText,
        sessionId: parserState.sessionId,
        error: partialText ? undefined : 'Codex query timed out after 60 minutes',
      });
    }, QUERY_TIMEOUT_MS);

    const onAbort = () => {
      logger.info('Codex CLI query aborted');
      child!.kill('SIGTERM');
      const partialText = parserState.textParts.join('\n').trim();
      finish({ text: partialText, sessionId: parserState.sessionId });
    };
    abortController?.signal.addEventListener('abort', onAbort, { once: true });

    const stderrParts: string[] = [];
    child.stderr!.setEncoding('utf8');
    child.stderr!.on('data', (chunk: string) => {
      stderrParts.push(chunk);
    });

    const rl = createInterface({ input: child.stdout! });
    rl.on('line', (line: string) => {
      handleStreamLine(line, parserState, parserCallbacks);
    });

    child.on('close', (code: number | null) => {
      clearTimeout(timeoutId);
      abortController?.signal.removeEventListener('abort', onAbort);

      if (code !== 0 && code !== null && !parserState.textParts.length && !parserState.errorMessage) {
        const stderr = stderrParts.join('').trim();
        parserState.errorMessage = stderr || `codex exited with code ${code}`;
        logger.error('Codex CLI exited with error', { code, stderr: stderr.slice(0, 500) });
      }

      const fullText = parserState.textParts.join('\n').trim();

      if (!fullText && !parserState.errorMessage) {
        parserState.errorMessage = 'Codex returned an empty response.';
      }

      logger.info("Codex CLI query completed", {
        sessionId: parserState.sessionId,
        textLength: fullText.length,
        hasError: !!parserState.errorMessage,
      });

      finish({
        text: fullText,
        sessionId: parserState.sessionId,
        error: parserState.errorMessage,
      });
    });

    child.on('error', (err: Error) => {
      clearTimeout(timeoutId);
      abortController?.signal.removeEventListener('abort', onAbort);
      finish({ text: '', sessionId: parserState.sessionId, error: `Failed to spawn codex: ${err.message}` });
    });
  });
}
