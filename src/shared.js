const fs = require("fs");
const path = require("path");
const os = require("os");

const VS = "agent-trace-sessions";
const VT = "agent-trace-view";
const VJ = "agent-trace-json";
const EXT = ["json", "jsonl", "ndjson"];
const SMART = 300;
const MDMAX = 250000;
const JLIM = 1000;
const TRACE_LARGE_BYTES = 16 * 1024 * 1024;
const RAW_PAGE_SIZE = 200;
const PROCESS_PAGE_SIZE = 200;
const PREVIEW_CHARS = 180;
const TITLE_SCAN_RECORDS = 120;
const DEFAULT_CODEX_HOME = process.env.CODEX_HOME || path.join(os.homedir(), ".codex");
const DEF = {
  codexHomePath: DEFAULT_CODEX_HOME,
  maxSessions: 300,
  compactConversation: true,
};

function obj(value) {
  return value && typeof value === "object" && !Array.isArray(value);
}

function str(value) {
  return typeof value === "string" ? value : undefined;
}

function err(error) {
  return error instanceof Error ? error.message : String(error);
}

function home(value) {
  if (value === "~") return os.homedir();
  return value.startsWith("~/") ? path.join(os.homedir(), value.slice(2)) : value;
}

function codexHomeFromLegacy(value) {
  const resolved = home(String(value || ""));
  const base = path.basename(resolved);
  return base === "sessions" || base === "archived_sessions" ? path.dirname(resolved) : resolved;
}

function dir(value) {
  try {
    return fs.statSync(value).isDirectory();
  } catch {
    return false;
  }
}

function fileStamp(value) {
  try {
    const stat = fs.statSync(value);
    return { size: stat.size, mtimeMs: stat.mtimeMs };
  } catch {
    return null;
  }
}

function sameStamp(a, b) {
  return Boolean(a && b && a.size === b.size && a.mtimeMs === b.mtimeMs);
}

function basename(value) {
  return value ? path.basename(value) : "";
}

function short(value) {
  return value.length > 12 ? `${value.slice(0, 8)}…${value.slice(-4)}` : value;
}

function displaySessionTitle(session, titleCounts) {
  const title = session.title || "Untitled session";
  const duplicate = (titleCounts.get(title) || 0) > 1;
  if (!duplicate && session.title) return title;
  const suffix = session.sessionId ? short(session.sessionId) : session.fileName;
  return `${title} · ${suffix}`;
}

function cap(value) {
  return value ? value[0].toUpperCase() + value.slice(1) : value;
}

function titleOf(value) {
  let text = String(value || "").trim();
  const transcriptTitleValue = transcriptTitle(text);
  if (transcriptTitleValue) text = transcriptTitleValue;
  return text.replace(/\s+/g, " ").trim().slice(0, 80) || "Untitled session";
}

function transcriptTitle(value) {
  const text = String(value || "").trim();
  if (!/^The following is the Codex agent history\b/i.test(text)) return undefined;
  const transcriptUser = text.match(/\[\d+\]\s+user:\s*([^\r\n]+)/i);
  return transcriptUser ? transcriptUser[1].trim() : undefined;
}

function isBootstrap(value) {
  const text = String(value || "").trim();
  return /^#\s*AGENTS\.md\b/i.test(text)
    || /^<recommended_plugins>/i.test(text)
    || /^<skills_instructions>/i.test(text)
    || /^<plugins_instructions>/i.test(text)
    || /^<apps_instructions>/i.test(text)
    || /^<collaboration_mode>/i.test(text)
    || /^<permissions instructions>/i.test(text)
    || /^<environment_context>/i.test(text)
    || /^<turn_aborted>/i.test(text)
    || /^The following is the Codex agent history\b/i.test(text)
    || /^The following is the Codex agent history added since your last approval assessment\b/i.test(text)
    || /^You are Codex\b/i.test(text);
}

function isUserMessageEvent(record) {
  return record?.type === "event_msg"
    && (record.payload?.type === "user_message" || record.payload?.item?.type === "UserMessage");
}

function previewOf(value) {
  return value.replace(/\s+/g, " ").trim().slice(0, PREVIEW_CHARS);
}

function fmt(milliseconds) {
  return new Date(milliseconds).toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

function time(value) {
  const date = new Date(value);
  return isNaN(date) ? String(value).slice(0, 8) : date.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

function day(milliseconds) {
  const now = new Date();
  const target = new Date(milliseconds);
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const date = new Date(target.getFullYear(), target.getMonth(), target.getDate()).getTime();
  const difference = Math.round((today - date) / 86400000);
  return difference === 0 ? "Today" : difference === 1 ? "Yesterday" : "Earlier";
}

function looksMd(value) {
  return /(^|\n)#{1,6}\s|(^|\n)\s*[-*+]\s|```|\[[^\]]+\]\([^\)]+\)|(^|\n)>\s/m.test(value);
}

function tryJson(value) {
  const trimmed = value.trim();
  if (!(trimmed.startsWith("{") || trimmed.startsWith("["))) return null;
  try {
    return JSON.parse(trimmed);
  } catch {
    return null;
  }
}

function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  const units = ["KB", "MB", "GB"];
  let value = bytes;
  let unit = "B";
  for (const next of units) {
    value /= 1024;
    unit = next;
    if (value < 1024 || next === units[units.length - 1]) break;
  }
  return `${value.toFixed(value >= 10 ? 0 : 1)} ${unit}`;
}

function formatChars(chars) {
  return `${Number(chars || 0).toLocaleString()} chars`;
}

function hashText(value) {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16);
}

function filterSessions(sessions, query) {
  const needle = String(query || "").trim().toLocaleLowerCase();
  if (!needle) return sessions;
  return sessions.filter((session) => [
    session.title,
    session.cwd,
    session.sessionId,
    session.filePath,
    session.fileName,
    session.archived ? "archived" : "active",
  ].some((value) => String(value || "").toLocaleLowerCase().includes(needle)));
}

module.exports = {
  VS,
  VT,
  VJ,
  EXT,
  SMART,
  MDMAX,
  JLIM,
  TRACE_LARGE_BYTES,
  RAW_PAGE_SIZE,
  PROCESS_PAGE_SIZE,
  TITLE_SCAN_RECORDS,
  DEFAULT_CODEX_HOME,
  DEF,
  obj,
  str,
  err,
  home,
  codexHomeFromLegacy,
  dir,
  fileStamp,
  sameStamp,
  basename,
  short,
  displaySessionTitle,
  cap,
  titleOf,
  transcriptTitle,
  isBootstrap,
  isUserMessageEvent,
  previewOf,
  fmt,
  time,
  day,
  looksMd,
  tryJson,
  formatBytes,
  formatChars,
  hashText,
  filterSessions,
};
