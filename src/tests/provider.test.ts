import { test } from 'node:test';
import assert from 'node:assert/strict';
import { handleStreamLine, type StreamParserState } from '../claude/provider.js';

function freshState(): StreamParserState {
  return { sessionId: '', textParts: [] };
}

test('handleStreamLine: thread.started 设置 sessionId', () => {
  const state = freshState();
  handleStreamLine(
    JSON.stringify({ type: 'thread.started', thread_id: 'thread-123' }),
    state,
    {},
  );
  assert.equal(state.sessionId, 'thread-123');
});

test('handleStreamLine: agent_message 累积文本并触发回调', () => {
  const calls: string[] = [];
  const turns: string[] = [];
  const state = freshState();
  handleStreamLine(
    JSON.stringify({
      type: 'item.completed',
      item: { type: 'agent_message', text: 'hello' },
    }),
    state,
    { onText: (t) => calls.push(t), onTurnEnd: (r) => turns.push(r) },
  );
  assert.deepEqual(calls, ['hello']);
  assert.deepEqual(turns, ['end_turn']);
  assert.deepEqual(state.textParts, ['hello']);
});

test('handleStreamLine: 空行和非法 JSON 静默跳过', () => {
  const state = freshState();
  handleStreamLine('', state, {});
  handleStreamLine('not json', state, {});
  handleStreamLine('   ', state, {});
  assert.deepEqual(state.textParts, []);
});

test('handleStreamLine: turn.failed 记录错误', () => {
  const state = freshState();
  handleStreamLine(
    JSON.stringify({ type: 'turn.failed', message: 'boom' }),
    state,
    {},
  );
  assert.equal(state.errorMessage, 'boom');
});
