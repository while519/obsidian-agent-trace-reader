"use strict";
const assert = require("node:assert/strict");
const test = require("node:test");
const { appendPointer, resolvePointer, searchValue, parseJsonlPage, kindOf } = require("../src/structured-data");
const { pairCalls, projectTurns, eventTimeline, timelineBounds, searchEvents } = require("../src/trace-model");
const { parseTrace } = require("../src/sources/codex");

test("JSON pointers preserve Unicode, slashes and tildes", () => {
  const data = { "中文/环境": { "a~b": [0, { foo: "bar" }] } };
  const path = appendPointer(appendPointer("", "中文/环境"), "a~b") + "/1/foo";
  assert.equal(path, "/中文~1环境/a~0b/1/foo");
  assert.equal(resolvePointer(data, path), "bar");
  assert.equal(resolvePointer(data, "/absent"), undefined);
  assert.equal(kindOf(null), "null");
});

test("search matches keys, values and JSON Pointer paths with budget", () => {
  const value = { "request/headers": { "x-token": "secret", empty: null }, blocks: [{ message: "hello world" }] };
  const byValue = searchValue(value, "hello");
  assert.ok(byValue.matches.some(match => match.path === "/blocks/0/message"));
  const byPath = searchValue(value, "request~1headers");
  assert.ok(byPath.matches.some(match => match.path === "/request~1headers"));
  const bounded = searchValue(value, "o", { limit: 1 });
  assert.equal(bounded.matches.length, 1);
  assert.equal(bounded.truncated, true);
});

test("JSONL page parses only requested lines and preserves invalid lines", () => {
  const lines = ['{"id":1}', '{"id":2}', "broken", '{"id":4}', '{"id":5}'];
  const first = parseJsonlPage(lines, 0, 2);
  assert.deepEqual(first.records.map(x => x.value.id), [1, 2]);
  assert.equal(first.more, true);
  const second = parseJsonlPage(lines, 1, 2);
  assert.equal(second.records[0].line, 3);
  assert.ok(second.records[0].error);
  assert.equal(second.records[1].value.id, 4);
});

test("call_id pairing uses actual timestamps and never pairs missing IDs", () => {
  const events = [
    { index: 1, kind: "tool-call", title: "shell", callId: "abc", timestamp: "2026-09-22T01:00:00.000Z" },
    { index: 2, kind: "tool-call", title: "other", timestamp: "2026-09-22T01:00:01.000Z" },
    { index: 3, kind: "tool-result", timestamp: "2026-09-22T01:00:02.000Z" },
    { index: 4, kind: "tool-result", callId: "abc", timestamp: "2026-09-22T01:00:03.500Z", explicitError: true },
  ];
  const pairs = pairCalls(events);
  assert.equal(pairs.get(1).durationMs, 3500);
  assert.equal(pairs.get(4).call.index, 1);
  assert.equal(pairs.get(1).explicitError, true);
  assert.equal(pairs.has(2), false);
  assert.equal(pairs.has(3), false);
  const bounds = timelineBounds(events);
  assert.equal(eventTimeline(events[0], pairs.get(1), bounds).durationMs, 3500);
});

test("duration stays unknown for absent and reversed timestamps", () => {
  const pairs = pairCalls([
    { index: 0, kind: "tool-call", callId: "x" },
    { index: 1, kind: "tool-result", callId: "x", timestamp: "2026-09-22T01:00:02Z" },
    { index: 2, kind: "tool-call", callId: "y", timestamp: "2026-09-22T01:00:04Z" },
    { index: 3, kind: "tool-result", callId: "y", timestamp: "2026-09-22T01:00:02Z" },
  ]);
  assert.equal(pairs.get(0).durationMs, null);
  assert.equal(pairs.get(2).durationMs, null);
});

test("turn model preserves session setup and ordinary events", () => {
  const events = [
    { kind: "metadata", index: 0 },
    { kind: "user", index: 1, bootstrap: true },
    { kind: "user", index: 2, bootstrap: false },
    { kind: "tool-call", index: 3, title: "exec_command", preview: "pwd" },
    { kind: "assistant", index: 4 },
    { kind: "user", index: 5, bootstrap: false },
  ];
  const groups = projectTurns(events);
  assert.equal(groups.length, 3);
  assert.deepEqual(groups.map(x => x.label), ["Session setup", "Turn 1", "Turn 2"]);
  assert.deepEqual(groups[0].events.map(x => x.index), [0, 1]);
  assert.equal(searchEvents(events, "exec").length, 1);
});

test("Codex normalization retains call_id and only explicit error flags", () => {
  const lines = [
    { type: "response_item", timestamp: "2026-09-22T01:00:00Z", payload: { type: "function_call", call_id: "call_1", name: "exec_command", arguments: '{"cmd":"pwd"}' } },
    { type: "response_item", timestamp: "2026-09-22T01:00:01Z", payload: { type: "function_call_output", call_id: "call_1", output: "oops", is_error: true } },
    { type: "response_item", timestamp: "2026-09-22T01:00:02Z", payload: { type: "function_call_output", name: "async_result", output: "plain text says ERROR" } },
  ];
  const trace = parseTrace(lines.map(x => JSON.stringify(x)).join("\n"));
  assert.equal(trace.events[0].callId, "call_1");
  assert.equal(trace.events[1].callId, "call_1");
  assert.equal(trace.events[1].explicitError, true);
  assert.equal(trace.events[2].callId, undefined);
  assert.notEqual(trace.events[2].explicitError, true);
});