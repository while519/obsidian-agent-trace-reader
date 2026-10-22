"use strict";
const assert = require("node:assert/strict");
const test = require("node:test");
const { commandText, isCommandTool, copyLabelForEvent } = require("../src/trace-copy");

test("extracts a shell command from JSON-encoded tool arguments", () => {
  const event = {
    kind: "tool-call",
    title: "exec_command",
    raw: { payload: { name: "exec_command", arguments: JSON.stringify({ cmd: "git status --short" }) } },
  };
  assert.equal(commandText(event), "git status --short");
  assert.equal(copyLabelForEvent(event), "Copy command");
});

test("quotes argv safely when a command is represented as an argument array", () => {
  const event = {
    kind: "tool-call",
    title: "exec_command",
    raw: { payload: { arguments: { cmd: ["bash", "-lc", "echo 'hello world'"] } } },
  };
  assert.equal(commandText(event), "bash -lc 'echo '\\''hello world'\\'''");
});

test("keeps non-command tool inputs distinct from shell commands", () => {
  const event = {
    kind: "tool-call",
    title: "read_file",
    content: '{"path":"README.md"}',
  };
  assert.equal(commandText(event), undefined);
  assert.equal(isCommandTool(event), false);
  assert.equal(copyLabelForEvent(event), "Copy tool input");
});

test("uses semantic copy labels for messages and tool results", () => {
  assert.equal(copyLabelForEvent({ kind: "user" }), "Copy message");
  assert.equal(copyLabelForEvent({ kind: "assistant" }), "Copy message");
  assert.equal(copyLabelForEvent({ kind: "tool-result" }), "Copy result");
  assert.equal(copyLabelForEvent({ kind: "reasoning" }), "Copy reasoning");
});
