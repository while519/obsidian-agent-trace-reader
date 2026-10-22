"use strict";

function payloadOf(event) {
  const raw = event?.raw;
  if (!raw || typeof raw !== "object") return {};
  const payload = raw.payload && typeof raw.payload === "object" ? raw.payload : {};
  const item = payload.item && typeof payload.item === "object" ? payload.item : {};
  return { ...item, ...payload };
}

function parseArguments(value) {
  if (typeof value !== "string") return value;
  try { return JSON.parse(value); }
  catch { return value; }
}

function shellQuote(value) {
  const text = String(value);
  if (text === "") return "''";
  if (/^[A-Za-z0-9_./:=+-]+$/.test(text)) return text;
  return "'" + text.replace(/'/g, "'\\''") + "'";
}

function commandText(event) {
  if (!event || event.kind !== "tool-call") return undefined;
  const payload = payloadOf(event);
  const args = parseArguments(payload.arguments ?? payload.input ?? payload.params);
  const command = args && typeof args === "object" && !Array.isArray(args)
    ? args.cmd ?? args.command ?? args.commands
    : undefined;
  const direct = command ?? payload.command ?? payload.cmd ?? payload.commands;
  if (typeof direct === "string") return direct;
  if (Array.isArray(direct)) return direct.map(shellQuote).join(" ");
  if (direct !== undefined && direct !== null) return JSON.stringify(direct, null, 2);
  if (typeof args === "string" && isCommandTool(event)) return args;
  return undefined;
}

function isCommandTool(event) {
  return event?.kind === "tool-call"
    && /(?:exec[_-]?command|run[_-]?command|shell|terminal|powershell|bash)/i.test(
      String(event.title || event.sourceSubtype || ""),
    );
}

function copyLabelForEvent(event) {
  if (event?.kind === "user" || event?.kind === "assistant") return "Copy message";
  if (event?.kind === "tool-call") return isCommandTool(event) || commandText(event) !== undefined
    ? "Copy command"
    : "Copy tool input";
  if (event?.kind === "tool-result") return "Copy result";
  if (event?.kind === "reasoning") return "Copy reasoning";
  return "Copy content";
}

module.exports = { commandText, isCommandTool, copyLabelForEvent };
