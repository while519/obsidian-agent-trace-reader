"use strict";

// Codex rollout records are *events*, not OpenTelemetry spans.
// This projection never invents parent span IDs, tool costs, or latencies.
function timestampMs(event) {
  const time = event?.timestamp ? Date.parse(event.timestamp) : NaN;
  return Number.isFinite(time) ? time : null;
}
function pairCalls(events) {
  const waiting = new Map();
  const pairs = new Map();
  for (const event of events) {
    if (!event.callId) continue;
    if (event.kind === "tool-call") {
      if (!waiting.has(event.callId)) waiting.set(event.callId, []);
      waiting.get(event.callId).push(event);
    } else if (event.kind === "tool-result") {
      const pending = waiting.get(event.callId);
      if (!pending?.length) continue;
      const call = pending.shift();
      const a = timestampMs(call);
      const b = timestampMs(event);
      const durationMs = a !== null && b !== null && b >= a ? b - a : null;
      const pair = { call, result: event, durationMs, explicitError: event.explicitError === true };
      pairs.set(call.index, pair);
      pairs.set(event.index, pair);
    }
  }
  return pairs;
}
function projectTurns(events) {
  const groups = [];
  let active = { id: "setup", label: "Session setup", events: [], number: 0 };
  for (const event of events) {
    if (event.kind === "user" && !event.bootstrap) {
      if (active.events.length) groups.push(active);
      active = { id: "turn-" + (groups.length + 1), label: "Turn " + (groups.filter(group => group.number).length + 1), events: [], number: groups.filter(group => group.number).length + 1 };
    }
    active.events.push(event);
  }
  if (active.events.length) groups.push(active);
  return groups;
}
function timelineBounds(events) {
  let min = Infinity, max = -Infinity;
  for (const event of events) {
    const t = timestampMs(event);
    if (t !== null) { min = Math.min(min, t); max = Math.max(max, t); }
  }
  return Number.isFinite(min) ? { start: min, end: max, range: Math.max(1, max - min) } : null;
}
function eventTimeline(event, paired, bounds) {
  if (!bounds) return null;
  const start = timestampMs(event);
  if (start === null) return null;
  const end = paired?.call === event && paired.durationMs !== null ? timestampMs(paired.result) : null;
  return {
    left: Math.max(0, Math.min(100, ((start - bounds.start) / bounds.range) * 100)),
    width: end === null ? 0 : Math.max(0, Math.min(100, ((end - start) / bounds.range) * 100)),
    durationMs: end === null ? null : end - start,
  };
}
function durationText(ms) {
  if (ms === null || ms === undefined) return "duration unavailable";
  if (ms < 1000) return Math.round(ms) + " ms";
  if (ms < 60000) return (ms / 1000).toFixed(2) + " s";
  return (ms / 60000).toFixed(1) + " min";
}
function eventLabel(event) {
  if (event.kind === "tool-call") return event.title || "Tool call";
  if (event.kind === "tool-result") return event.title || "Tool result";
  if (event.kind === "assistant") return "Assistant response";
  if (event.kind === "user") return "User message";
  return event.title || event.kind;
}
function searchEvents(events, query, kind) {
  const q = String(query || "").trim().toLocaleLowerCase();
  return events.filter(event => {
    if (kind && kind !== "all" && event.kind !== kind) return false;
    return !q || [event.kind, event.title, event.sourceSubtype, event.preview, event.callId].some(v => String(v || "").toLocaleLowerCase().includes(q));
  });
}
module.exports = { timestampMs, pairCalls, projectTurns, timelineBounds, eventTimeline, durationText, eventLabel, searchEvents };