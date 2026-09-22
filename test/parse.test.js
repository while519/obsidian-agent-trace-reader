const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");

function loadInternals() {
  return {
    ...require(path.join(__dirname, "..", "src", "sources", "codex.js")),
    ...require(path.join(__dirname, "..", "src", "shared.js")),
  };
}

function line(record) {
  return JSON.stringify(record);
}

test("prefers Codex event_msg user title and deduplicates mirrored messages", () => {
  const { parseTrace, conversationEvents, isBootstrap } = loadInternals();
  const raw = [
    line({ type: "session_meta", timestamp: "2026-09-22T01:00:00Z", payload: { id: "session-1", cwd: "/tmp/project" } }),
    line({ type: "response_item", timestamp: "2026-09-22T01:00:00.500Z", payload: { type: "message", role: "user", content: [{ type: "input_text", text: "<recommended_plugins>\nHere is a list of plugins that are available but not installed." }] } }),
    line({ type: "response_item", timestamp: "2026-09-22T01:00:01Z", payload: { type: "message", role: "user", content: [{ type: "input_text", text: "# AGENTS.md bootstrap" }] } }),
    line({ type: "event_msg", timestamp: "2026-09-22T01:00:03Z", payload: { type: "user_message", message: "Actual user request" } }),
    line({ type: "response_item", timestamp: "2026-09-22T01:00:02Z", payload: { type: "message", role: "assistant", content: [{ type: "output_text", text: "First answer" }] } }),
    line({ type: "event_msg", timestamp: "2026-09-22T01:00:04Z", payload: { type: "agent_message", message: "First answer" } }),
    line({ type: "response_item", timestamp: "2026-09-22T01:00:05Z", payload: { type: "reasoning", summary: [{ type: "summary_text", text: "Checking the request" }] } }),
    line({ type: "response_item", timestamp: "2026-09-22T01:00:06Z", payload: { type: "function_call", name: "exec_command", arguments: "{\"cmd\":\"true\"}" } }),
    line({ type: "response_item", timestamp: "2026-09-22T01:00:07Z", payload: { type: "function_call_output", call_id: "call-1", output: "ok" } }),
    line({ type: "world_state", payload: { state: { hidden: true } } }),
    "not-json",
  ].join("\n");

  const trace = parseTrace(raw);
  assert.equal(trace.title, "Actual user request");
  assert.equal(trace.sessionId, "session-1");
  assert.equal(trace.cwd, "/tmp/project");
  assert.equal(trace.errors.length, 1);
  assert.equal(trace.events.filter((event) => event.kind === "assistant").length, 1);
  assert.equal(trace.events.filter((event) => event.kind === "user").length, 3);
  assert.equal(trace.events.filter((event) => event.kind === "tool-call").length, 1);
  assert.equal(trace.events.filter((event) => event.kind === "tool-result").length, 1);
  assert.ok(trace.events.some((event) => event.kind === "unknown" && event.sourceType === "world_state"));
  const conversation = conversationEvents(trace.events);
  assert.equal(conversation.filter((event) => event.kind === "user").length, 1);
  assert.equal(conversation.find((event) => event.kind === "user").content, "Actual user request");
  assert.ok(conversation.some((event) => event.kind === "assistant"));
  assert.equal(isBootstrap("<recommended_plugins>\nHere is a list of plugins"), true);
  assert.equal(isBootstrap("Actual user request"), false);
});

test("recognizes current UserMessage completion events as title candidates", () => {
  const { parseTrace } = loadInternals();
  const raw = [
    line({ type: "session_meta", timestamp: "2026-09-22T01:00:00Z", payload: { id: "session-2" } }),
    line({ type: "response_item", timestamp: "2026-09-22T01:00:01Z", payload: { type: "message", role: "user", content: [{ type: "input_text", text: "<environment_context>\nInjected context" }] } }),
    line({ type: "event_msg", timestamp: "2026-09-22T01:00:02Z", payload: { type: "item_completed", item: { type: "UserMessage", content: [{ type: "text", text: "Real request from current Codex schema" }] } } }),
  ].join("\n");

  const trace = parseTrace(raw);
  assert.equal(trace.title, "Real request from current Codex schema");
});

test("uses the embedded request for approval-review sessions without exposing the wrapper", () => {
  const { parseTrace, conversationEvents } = loadInternals();
  const wrapper = "The following is the Codex agent history whose request action you are assessing.\n>>> TRANSCRIPT START\n[1] user: Review the plugin changes\n>>> TRANSCRIPT END";
  const raw = [
    line({ type: "session_meta", timestamp: "2026-09-22T01:00:00Z", payload: { id: "review-1" } }),
    line({ type: "response_item", timestamp: "2026-09-22T01:00:01Z", payload: { type: "message", role: "user", content: [{ type: "input_text", text: wrapper }] } }),
  ].join("\n");

  const trace = parseTrace(raw);
  assert.equal(trace.title, "Review the plugin changes");
  const conversation = conversationEvents(trace.events);
  assert.equal(conversation.filter((event) => event.kind === "user").length, 1);
  assert.equal(conversation[0].content, "Review the plugin changes");
  assert.equal(conversation[0].content.includes("Codex agent history"), false);
});

test("disambiguates repeated overview titles with a stable session suffix", () => {
  const { displaySessionTitle } = loadInternals();
  const counts = new Map([["hi", 2], ["Untitled session", 1]]);
  assert.equal(displaySessionTitle({ title: "hi", sessionId: "01a0abcdef-1234" }, counts), "hi · 01a0abcd…1234");
  assert.equal(displaySessionTitle({ title: "unique", sessionId: "01a0abcdef-5678" }, new Map([["unique", 1]])), "unique");
  assert.equal(displaySessionTitle({ sessionId: "01a0abcdef-9999", fileName: "rollout.jsonl" }, counts), "Untitled session · 01a0abcd…9999");
});

test("streams large traces and hydrates events only when requested", async () => {
  const { parseTraceFile, hydrateEvent, copyEventCollection } = loadInternals();
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "agent-trace-reader-"));
  const filePath = path.join(tempDir, "rollout-large.jsonl");
  const filler = "中文跨chunk-".repeat(10000);
  const records = [
    line({ type: "session_meta", timestamp: "2026-09-22T01:00:00Z", payload: { id: "large", cwd: "/tmp/project" } }),
  ];
  for (let index = 0; index < 140; index += 1) {
    records.push(line({
      type: "response_item",
      timestamp: "2026-09-22T01:00:01Z",
      payload: { type: "message", role: "assistant", content: [{ type: "output_text", text: `${filler}-${index}` }] },
    }));
  }
  fs.writeFileSync(filePath, `${records.join("\n")}\n`);

  try {
    const trace = await parseTraceFile(filePath);
    assert.equal(trace.isLarge, true);
    assert.equal(trace.lineCount, records.length);
    const assistant = trace.events.find((event) => event.kind === "assistant");
    assert.ok(assistant);
    assert.equal(assistant.content, undefined);
    assert.equal(assistant.raw, undefined);
    assert.equal(assistant.hasContent, true);
    assert.equal(hydrateEvent(assistant).content, `${filler}-0`);
    assert.equal(hydrateEvent(assistant).raw.payload.role, "assistant");
    const copied = await copyEventCollection(trace.events.filter((event) => event.kind === "assistant").slice(0, 2));
    assert.ok(copied.startsWith(`${filler}-0\n\n${filler}-1`));
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

test("re-reading a growing trace includes records appended after the first read", async () => {
  const { parseTraceFile } = loadInternals();
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "agent-trace-reader-refresh-"));
  const filePath = path.join(tempDir, "rollout-running.jsonl");
  const first = line({
    type: "session_meta",
    timestamp: "2026-09-22T01:00:00Z",
    payload: { id: "running" },
  });
  const next = line({
    type: "event_msg",
    timestamp: "2026-09-22T01:00:01Z",
    payload: { type: "user_message", message: "Appended request" },
  });

  try {
    fs.writeFileSync(filePath, `${first}\n`);
    const initial = await parseTraceFile(filePath);
    assert.equal(initial.lineCount, 1);
    assert.equal(initial.title, "Untitled session");

    fs.appendFileSync(filePath, `${next}\n`);
    const refreshed = await parseTraceFile(filePath);
    assert.equal(refreshed.lineCount, 2);
    assert.equal(refreshed.title, "Appended request");
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

test("discovers active and archived Codex rollouts under a Codex home", async () => {
  const { scan, codexHomeFromLegacy } = loadInternals();
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "agent-trace-reader-home-"));
  const activeDir = path.join(tempDir, "sessions", "2026", "09", "22");
  const archivedDir = path.join(tempDir, "archived_sessions", "2026", "09", "21");
  fs.mkdirSync(activeDir, { recursive: true });
  fs.mkdirSync(archivedDir, { recursive: true });

  try {
    const activeRecords = [
      line({ type: "session_meta", payload: { id: "active", cwd: "/tmp/active" } }),
      line({ type: "event_msg", payload: { type: "user_message", message: "Active" } }),
    ].join("\n") + "\n";
    const archivedRecords = [
      line({ type: "session_meta", payload: { id: "archived", cwd: "/tmp/archived" } }),
      line({ type: "event_msg", payload: { type: "user_message", message: "Archived" } }),
    ].join("\n") + "\n";
    fs.writeFileSync(path.join(activeDir, "rollout-active.jsonl"), activeRecords);
    fs.writeFileSync(path.join(archivedDir, "rollout-archived.jsonl"), archivedRecords);

    const sessions = await scan(tempDir, 2);
    assert.equal(sessions.length, 2);
    assert.equal(sessions.find((session) => session.sessionId === "active").archived, false);
    assert.equal(sessions.find((session) => session.sessionId === "archived").archived, true);
    assert.equal(codexHomeFromLegacy(path.join(tempDir, "sessions")), tempDir);
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

test("filters sessions by title, cwd, id, path, and archive state", () => {
  const { filterSessions } = loadInternals();
  const sessions = [
    { title: "Deploy service", cwd: "/tmp/project", sessionId: "active-1", filePath: "/tmp/sessions/rollout-active.jsonl", fileName: "rollout-active.jsonl", archived: false },
    { title: "Review history", cwd: "/tmp/archive", sessionId: "archived-2", filePath: "/tmp/archived_sessions/rollout-archived.jsonl", fileName: "rollout-archived.jsonl", archived: true },
  ];
  assert.deepEqual(filterSessions(sessions, "deploy"), [sessions[0]]);
  assert.deepEqual(filterSessions(sessions, "/tmp/archive"), [sessions[1]]);
  assert.deepEqual(filterSessions(sessions, "archived-2"), [sessions[1]]);
  assert.deepEqual(filterSessions(sessions, "archived"), [sessions[1]]);
  assert.deepEqual(filterSessions(sessions, ""), sessions);
});
