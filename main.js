var __getOwnPropNames = Object.getOwnPropertyNames;
var __commonJS = (cb, mod) => function __require() {
  return mod || (0, cb[__getOwnPropNames(cb)[0]])((mod = { exports: {} }).exports, mod), mod.exports;
};

// src/shared.js
var require_shared = __commonJS({
  "src/shared.js"(exports2, module2) {
    var fs = require("fs");
    var path = require("path");
    var os = require("os");
    var VS2 = "agent-trace-sessions";
    var VT2 = "agent-trace-view";
    var VJ2 = "agent-trace-json";
    var EXT2 = ["json", "jsonl", "ndjson"];
    var SMART = 300;
    var MDMAX = 25e4;
    var JLIM = 1e3;
    var TRACE_LARGE_BYTES = 16 * 1024 * 1024;
    var RAW_PAGE_SIZE = 200;
    var PROCESS_PAGE_SIZE = 200;
    var PREVIEW_CHARS = 180;
    var TITLE_SCAN_RECORDS = 120;
    var DEFAULT_CODEX_HOME = process.env.CODEX_HOME || path.join(os.homedir(), ".codex");
    var DEF2 = {
      codexHomePath: DEFAULT_CODEX_HOME,
      maxSessions: 300,
      compactConversation: true
    };
    function obj(value) {
      return value && typeof value === "object" && !Array.isArray(value);
    }
    function str(value) {
      return typeof value === "string" ? value : void 0;
    }
    function err(error) {
      return error instanceof Error ? error.message : String(error);
    }
    function home(value) {
      if (value === "~") return os.homedir();
      return value.startsWith("~/") ? path.join(os.homedir(), value.slice(2)) : value;
    }
    function codexHomeFromLegacy2(value) {
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
      return value.length > 12 ? `${value.slice(0, 8)}\u2026${value.slice(-4)}` : value;
    }
    function displaySessionTitle(session, titleCounts) {
      const title = session.title || "Untitled session";
      const duplicate = (titleCounts.get(title) || 0) > 1;
      if (!duplicate && session.title) return title;
      const suffix = session.sessionId ? short(session.sessionId) : session.fileName;
      return `${title} \xB7 ${suffix}`;
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
      if (!/^The following is the Codex agent history\b/i.test(text)) return void 0;
      const transcriptUser = text.match(/\[\d+\]\s+user:\s*([^\r\n]+)/i);
      return transcriptUser ? transcriptUser[1].trim() : void 0;
    }
    function isBootstrap(value) {
      const text = String(value || "").trim();
      return /^#\s*AGENTS\.md\b/i.test(text) || /^<recommended_plugins>/i.test(text) || /^<skills_instructions>/i.test(text) || /^<plugins_instructions>/i.test(text) || /^<apps_instructions>/i.test(text) || /^<collaboration_mode>/i.test(text) || /^<permissions instructions>/i.test(text) || /^<environment_context>/i.test(text) || /^<turn_aborted>/i.test(text) || /^The following is the Codex agent history\b/i.test(text) || /^The following is the Codex agent history added since your last approval assessment\b/i.test(text) || /^You are Codex\b/i.test(text);
    }
    function isUserMessageEvent(record) {
      return record?.type === "event_msg" && (record.payload?.type === "user_message" || record.payload?.item?.type === "UserMessage");
    }
    function previewOf(value) {
      return value.replace(/\s+/g, " ").trim().slice(0, PREVIEW_CHARS);
    }
    function fmt(milliseconds) {
      return new Date(milliseconds).toLocaleString(void 0, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
    }
    function time(value) {
      const date = new Date(value);
      return isNaN(date) ? String(value).slice(0, 8) : date.toLocaleTimeString(void 0, { hour: "2-digit", minute: "2-digit", second: "2-digit" });
    }
    function day(milliseconds) {
      const now = /* @__PURE__ */ new Date();
      const target = new Date(milliseconds);
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
      const date = new Date(target.getFullYear(), target.getMonth(), target.getDate()).getTime();
      const difference = Math.round((today - date) / 864e5);
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
        session.archived ? "archived" : "active"
      ].some((value) => String(value || "").toLocaleLowerCase().includes(needle)));
    }
    module2.exports = {
      VS: VS2,
      VT: VT2,
      VJ: VJ2,
      EXT: EXT2,
      SMART,
      MDMAX,
      JLIM,
      TRACE_LARGE_BYTES,
      RAW_PAGE_SIZE,
      PROCESS_PAGE_SIZE,
      TITLE_SCAN_RECORDS,
      DEFAULT_CODEX_HOME,
      DEF: DEF2,
      obj,
      str,
      err,
      home,
      codexHomeFromLegacy: codexHomeFromLegacy2,
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
      filterSessions
    };
  }
});

// src/sources/codex.js
var require_codex = __commonJS({
  "src/sources/codex.js"(exports2, module2) {
    var fs = require("fs");
    var path = require("path");
    var {
      TRACE_LARGE_BYTES,
      TITLE_SCAN_RECORDS,
      obj,
      str,
      err,
      dir,
      cap,
      titleOf,
      transcriptTitle,
      isBootstrap,
      isUserMessageEvent,
      previewOf,
      hashText
    } = require_shared();
    async function parseTraceFile(filePath) {
      const stat = fs.statSync(filePath);
      const large = stat.size > TRACE_LARGE_BYTES;
      const events = [];
      const errors = [];
      const lineRefs = [];
      const meta = {
        sessionId: void 0,
        cwd: void 0,
        createdAt: void 0,
        sessionTitle: void 0,
        firstUser: void 0,
        preferredUser: void 0,
        reviewTitle: void 0
      };
      for await (const line of jsonlLines(filePath)) {
        lineRefs.push({ offset: line.offset, length: line.length, filePath });
        if (!line.text.trim()) continue;
        let record;
        try {
          record = JSON.parse(line.text);
        } catch (error) {
          errors.push({ line: line.line + 1, message: err(error) });
          continue;
        }
        const event = norm(record, events.length, { keepRaw: !large, keepContent: !large });
        event.lineNumber = line.line + 1;
        event.ref = { filePath, offset: line.offset, length: line.length };
        events.push(event);
        updateMeta(meta, record, event);
      }
      return finishTrace({
        events,
        errors,
        meta,
        filePath,
        fileSize: stat.size,
        lineRefs,
        lineCount: lineRefs.length,
        isLarge: large
      });
    }
    function parseTrace(raw) {
      const events = [];
      const errors = [];
      const meta = {
        sessionId: void 0,
        cwd: void 0,
        createdAt: void 0,
        sessionTitle: void 0,
        firstUser: void 0,
        preferredUser: void 0,
        reviewTitle: void 0
      };
      const lineRefs = [];
      raw.split(/\r?\n/).forEach((line, lineNumber) => {
        lineRefs.push({ offset: null, length: line.length, filePath: null });
        if (!line.trim()) return;
        let record;
        try {
          record = JSON.parse(line);
        } catch (error) {
          errors.push({ line: lineNumber + 1, message: err(error) });
          return;
        }
        const event = norm(record, events.length, { keepRaw: true, keepContent: true });
        event.lineNumber = lineNumber + 1;
        events.push(event);
        updateMeta(meta, record, event);
      });
      return finishTrace({
        events,
        errors,
        meta,
        raw,
        filePath: null,
        fileSize: Buffer.byteLength(raw, "utf8"),
        lineRefs,
        lineCount: lineRefs.length,
        isLarge: false
      });
    }
    function finishTrace({ events, errors, meta, ...rest }) {
      return {
        events: dedupeMessages(events),
        errors,
        sessionId: meta.sessionId,
        cwd: meta.cwd,
        createdAt: meta.createdAt,
        title: titleOf(meta.sessionTitle || meta.preferredUser || meta.firstUser || meta.reviewTitle || ""),
        ...rest
      };
    }
    function updateMeta(meta, record, event) {
      const payload = obj(record?.payload) ? record.payload : null;
      if (record?.type === "session_meta" && payload) {
        meta.sessionId = str(payload.id) || str(payload.session_id) || meta.sessionId;
        meta.cwd = str(payload.cwd) || meta.cwd;
        meta.createdAt = str(record.timestamp) || str(payload.timestamp) || meta.createdAt;
        const sessionTitle = str(payload.title);
        if (sessionTitle && !isBootstrap(sessionTitle)) meta.sessionTitle = sessionTitle;
      }
      if (event.kind !== "user" || !event.hasContent) return;
      const candidate = event.content !== void 0 ? event.content : event.preview;
      if (isBootstrap(candidate)) {
        if (!meta.reviewTitle) meta.reviewTitle = transcriptTitle(candidate);
        return;
      }
      if (!meta.firstUser) meta.firstUser = candidate;
      if (isUserMessageEvent(record) && !meta.preferredUser) {
        meta.preferredUser = candidate;
      }
    }
    function norm(record, index, options = {}) {
      const keepRaw = options.keepRaw !== false;
      const keepContent = options.keepContent !== false;
      if (!obj(record)) {
        return makeEvent(index, void 0, "unknown", "unknown", "Unknown", void 0, record, { keepRaw, keepContent });
      }
      const timestamp = str(record.timestamp);
      const sourceType = str(record.type) || "unknown";
      const payload = obj(record.payload) ? record.payload : null;
      if (sourceType === "session_meta") {
        return makeEvent(index, timestamp, sourceType, "metadata", "Session metadata", void 0, record, { keepRaw, keepContent });
      }
      if (sourceType === "turn_context") {
        return makeEvent(index, timestamp, sourceType, "metadata", "Turn context", void 0, record, { keepRaw, keepContent });
      }
      if (sourceType === "response_item" && payload) return responseEvent(record, payload, index, timestamp, { keepRaw, keepContent });
      if (sourceType === "event_msg" && payload) return eventMessage(record, payload, index, timestamp, { keepRaw, keepContent });
      return makeEvent(index, timestamp, sourceType, "unknown", sourceType, extract(record), record, { keepRaw, keepContent });
    }
    function responseEvent(record, payload, index, timestamp, options) {
      const type = str(payload.type) || "response_item";
      const role = str(payload.role);
      const text = extract(payload);
      const normalizedRole = role?.toLowerCase();
      if (type === "message") {
        const kind = normalizedRole === "user" ? "user" : normalizedRole === "assistant" ? "assistant" : normalizedRole === "system" || normalizedRole === "developer" ? "system" : "event";
        return makeEvent(index, timestamp, "response_item", kind, cap(role || "message"), text, record, options, { role });
      }
      if (/function_call_output|tool_output|custom_tool_call_output/i.test(type)) {
        return makeEvent(
          index,
          timestamp,
          "response_item",
          "tool-result",
          str(payload.name) || str(payload.call_id) || "Tool result",
          text || str(payload.output),
          record,
          options,
          { sourceSubtype: type, callId: str(payload.call_id) || void 0, explicitError: payload.is_error === true || payload.isError === true || payload.status === "error" }
        );
      }
      if (/function_call|tool_call|custom_tool_call/i.test(type)) {
        const args = payload.arguments ?? payload.input ?? payload.params;
        const content = typeof args === "string" ? args : args !== void 0 ? JSON.stringify(args, null, 2) : text;
        return makeEvent(
          index,
          timestamp,
          "response_item",
          "tool-call",
          str(payload.name) || str(payload.tool_name) || "Tool call",
          content,
          record,
          options,
          { sourceSubtype: type, callId: str(payload.call_id) || void 0 }
        );
      }
      if (/reason|analysis/i.test(type)) {
        return makeEvent(index, timestamp, "response_item", "reasoning", "Reasoning", text, record, options, { sourceSubtype: type });
      }
      return makeEvent(index, timestamp, "response_item", "event", type, text, record, options, { sourceSubtype: type });
    }
    function eventMessage(record, payload, index, timestamp, options) {
      const type = str(payload.type) || "event";
      const item = obj(payload.item) ? payload.item : null;
      const itemType = str(item?.type);
      const text = extract(payload) ?? extract(item);
      const subtype = itemType ? `${type}:${itemType}` : type;
      if (type === "user_message" || itemType === "UserMessage") {
        return makeEvent(index, timestamp, "event_msg", "user", "User", text, record, options, { sourceSubtype: subtype, role: "user" });
      }
      if (type === "agent_message" || itemType === "AgentMessage") {
        return makeEvent(index, timestamp, "event_msg", "assistant", "Assistant", text, record, options, { sourceSubtype: subtype, role: "assistant" });
      }
      if (/reason|analysis/i.test(type) || itemType === "Reasoning") {
        return makeEvent(index, timestamp, "event_msg", "reasoning", "Reasoning", text, record, options, { sourceSubtype: subtype });
      }
      return makeEvent(index, timestamp, "event_msg", "event", itemType || type, text, record, options, { sourceSubtype: subtype });
    }
    function makeEvent(index, timestamp, sourceType, kind, title, content, record, options, extra = {}) {
      const hasContent = typeof content === "string";
      const event = {
        index,
        timestamp,
        sourceType,
        kind,
        title: title || kind,
        hasContent,
        contentLength: hasContent ? content.length : 0,
        preview: hasContent ? previewOf(content) : void 0,
        ...extra
      };
      if (hasContent && (kind === "user" || kind === "assistant")) event.contentHash = hashText(content);
      if (kind === "user" && hasContent) event.bootstrap = isBootstrap(content);
      if (options.keepContent && hasContent) event.content = content;
      if (options.keepRaw) event.raw = record;
      return event;
    }
    function extract(value) {
      if (typeof value === "string") return value;
      if (Array.isArray(value)) {
        const parts = value.map(extract).filter((item) => item !== void 0);
        return parts.length ? parts.join("\n\n") : void 0;
      }
      if (!obj(value)) return void 0;
      for (const key of ["text", "message", "content", "output_text", "input_text", "output", "summary"]) {
        const result = extract(value[key]);
        if (result !== void 0 && result !== "") return result;
      }
      return void 0;
    }
    function conversationEvents(events) {
      const out = [];
      const seenReasoning = /* @__PURE__ */ new Set();
      const hasResponseReasoning = events.some(
        (event) => event.kind === "reasoning" && event.sourceType === "response_item"
      );
      const hasReadableResponseReasoning = events.some(
        (event) => event.kind === "reasoning" && event.sourceType === "response_item" && event.hasContent
      );
      const hasReadableEventReasoning = events.some(
        (event) => event.kind === "reasoning" && event.sourceType === "event_msg" && event.hasContent
      );
      for (const original of events) {
        const event = projectConversationEvent(original);
        if (!event) continue;
        const direct = ["user", "assistant", "system", "tool-call", "tool-result", "reasoning"].includes(event.kind);
        if (!direct) continue;
        if (event.sourceType === "event_msg" && event.sourceSubtype === "item_completed:Reasoning" && hasResponseReasoning && (hasReadableResponseReasoning || !event.hasContent)) continue;
        if (event.sourceType === "response_item" && event.sourceSubtype === "reasoning" && !hasReadableResponseReasoning && hasReadableEventReasoning) continue;
        if (event.kind === "reasoning" && event.hasContent) {
          const key = `${event.contentLength}:${event.contentHash || hashText(event.content || event.preview || "")}`;
          if (seenReasoning.has(key)) continue;
          seenReasoning.add(key);
        }
        out.push(event);
      }
      return out;
    }
    function projectConversationEvent(event) {
      if (event.kind !== "user" || !event.hasContent) return event;
      let content = event.content;
      if (content === void 0 && isBootstrap(event.preview) && event.ref) {
        try {
          content = hydrateEvent(event)?.content;
        } catch {
        }
      }
      const candidate = content !== void 0 ? content : event.preview;
      if (!isBootstrap(candidate)) return event;
      const extracted = transcriptTitle(content || candidate);
      if (!extracted) return void 0;
      return {
        ...event,
        title: "User",
        content: extracted,
        contentLength: extracted.length,
        preview: previewOf(extracted),
        contentHash: hashText(extracted)
      };
    }
    function hydrateEvent(event) {
      if (event.raw !== void 0) return event;
      if (!event.ref) return event;
      const line = readLineRef(event.ref);
      const record = JSON.parse(line);
      const hydrated = norm(record, event.index, { keepRaw: true, keepContent: true });
      hydrated.lineNumber = event.lineNumber;
      hydrated.ref = event.ref;
      return hydrated;
    }
    async function hydrateEvents(events) {
      const handles = /* @__PURE__ */ new Map();
      const hydrated = [];
      try {
        for (const event of events) {
          if (event.raw !== void 0 || !event.ref) {
            hydrated.push(event);
            continue;
          }
          const filePath = event.ref.filePath;
          let handle = handles.get(filePath);
          if (!handle) {
            handle = await fs.promises.open(filePath, "r");
            handles.set(filePath, handle);
          }
          const record = JSON.parse(await readLineRefAsync(event.ref, handle));
          const next = norm(record, event.index, { keepRaw: true, keepContent: true });
          next.lineNumber = event.lineNumber;
          next.ref = event.ref;
          hydrated.push(next);
        }
        return hydrated;
      } finally {
        await Promise.all([...handles.values()].map((handle) => handle.close()));
      }
    }
    async function copyEventCollection(events) {
      const hydrated = await hydrateEvents(events);
      return hydrated.map((event, index) => {
        if (event.content !== void 0) return event.content;
        if (event.raw !== void 0) return JSON.stringify(event.raw, null, 2);
        return event.title || events[index].title || "";
      }).filter((value) => value !== void 0 && value !== "").join("\n\n");
    }
    async function* jsonlLines(filePath) {
      const stream = fs.createReadStream(filePath);
      let carry = Buffer.alloc(0);
      let carryOffset = 0;
      let lineNumber = 0;
      try {
        for await (const chunk of stream) {
          const data = carry.length ? Buffer.concat([carry, chunk]) : chunk;
          let start = 0;
          for (let end = 0; end < data.length; end += 1) {
            if (data[end] !== 10) continue;
            let contentEnd = end;
            if (contentEnd > start && data[contentEnd - 1] === 13) contentEnd -= 1;
            yield {
              line: lineNumber++,
              offset: carryOffset + start,
              length: contentEnd - start,
              text: data.toString("utf8", start, contentEnd)
            };
            start = end + 1;
          }
          if (start === data.length) {
            carry = Buffer.alloc(0);
            carryOffset += data.length;
          } else {
            carry = Buffer.from(data.subarray(start));
            carryOffset += start;
          }
        }
        if (carry.length) {
          let contentEnd = carry.length;
          if (contentEnd && carry[contentEnd - 1] === 13) contentEnd -= 1;
          yield {
            line: lineNumber,
            offset: carryOffset,
            length: contentEnd,
            text: carry.toString("utf8", 0, contentEnd)
          };
        }
      } finally {
        stream.destroy();
      }
    }
    function readLineRef(ref) {
      if (!ref || ref.offset === null || ref.length === void 0) return "";
      const fd = fs.openSync(ref.filePath, "r");
      try {
        const buffer = Buffer.alloc(ref.length);
        let total = 0;
        while (total < ref.length) {
          const read = fs.readSync(fd, buffer, total, ref.length - total, ref.offset + total);
          if (!read) break;
          total += read;
        }
        return buffer.toString("utf8", 0, total);
      } finally {
        fs.closeSync(fd);
      }
    }
    async function readLineRefAsync(ref, handle) {
      if (!ref || ref.offset === null || ref.length === void 0) return "";
      const buffer = Buffer.alloc(ref.length);
      let total = 0;
      while (total < ref.length) {
        const result = await handle.read(buffer, total, ref.length - total, ref.offset + total);
        if (!result.bytesRead) break;
        total += result.bytesRead;
      }
      return buffer.toString("utf8", 0, total);
    }
    async function scan(root, limit) {
      const found = [];
      collectRollouts(path.join(root, "sessions"), false, found);
      collectRollouts(path.join(root, "archived_sessions"), true, found);
      collectDirectRollouts(root, found);
      found.sort((a, b) => b.modifiedMs - a.modifiedMs);
      const selected = found.slice(0, limit);
      const sessions = [];
      for (const session of selected) sessions.push(await enrich(session));
      return sessions;
    }
    function collectRollouts(root, archived, found) {
      if (!dir(root)) return;
      const stack = [root];
      while (stack.length) {
        const current = stack.pop();
        let entries;
        try {
          entries = fs.readdirSync(current, { withFileTypes: true });
        } catch {
          continue;
        }
        for (const entry of entries) {
          const filePath = path.join(current, entry.name);
          if (entry.isDirectory()) {
            stack.push(filePath);
          } else if (isRollout(entry)) {
            addRollout(found, filePath, entry.name, archived);
          }
        }
      }
    }
    function collectDirectRollouts(root, found) {
      if (!dir(root)) return;
      let entries;
      try {
        entries = fs.readdirSync(root, { withFileTypes: true });
      } catch {
        return;
      }
      for (const entry of entries) {
        if (isRollout(entry)) addRollout(found, path.join(root, entry.name), entry.name, false);
      }
    }
    function isRollout(entry) {
      return entry.isFile() && entry.name.startsWith("rollout-") && entry.name.endsWith(".jsonl");
    }
    function addRollout(found, filePath, fileName, archived) {
      try {
        const stat = fs.statSync(filePath);
        found.push({ filePath, fileName, modifiedMs: stat.mtimeMs, archived });
      } catch {
      }
    }
    async function enrich(session) {
      let firstUser;
      let preferredUser;
      let reviewTitle;
      try {
        let records = 0;
        for await (const line of jsonlLines(session.filePath)) {
          if (!line.text.trim()) continue;
          let record;
          try {
            record = JSON.parse(line.text);
          } catch {
            continue;
          }
          records += 1;
          if (record.type === "session_meta" && obj(record.payload)) {
            session.sessionId = str(record.payload.id) || str(record.payload.session_id) || session.sessionId;
            session.cwd = str(record.payload.cwd) || session.cwd;
            session.createdAt = str(record.timestamp) || session.createdAt;
            const sessionTitle = str(record.payload.title);
            if (sessionTitle && !isBootstrap(sessionTitle)) session.title = sessionTitle;
          }
          const event = norm(record, 0, { keepRaw: false, keepContent: true });
          const candidate = event.content || event.preview;
          if (event.kind === "user" && event.hasContent) {
            if (isBootstrap(candidate)) {
              if (!reviewTitle) reviewTitle = transcriptTitle(candidate);
            } else {
              if (!firstUser) firstUser = candidate;
              if (isUserMessageEvent(record) && !preferredUser) preferredUser = candidate;
              if (preferredUser || firstUser) break;
            }
          }
          if (records >= TITLE_SCAN_RECORDS) break;
        }
      } catch {
      }
      if (!session.title && (preferredUser || firstUser || reviewTitle)) {
        session.title = titleOf(preferredUser || firstUser || reviewTitle);
      }
      return session;
    }
    function dedupeMessages(events) {
      const out = [];
      for (const event of events) {
        if ((event.kind === "user" || event.kind === "assistant") && event.hasContent) {
          let duplicate = false;
          for (let index = out.length - 1; index >= 0; index -= 1) {
            const previous = out[index];
            if (previous.kind === "assistant" && event.kind === "user" || previous.kind === "user" && event.kind === "assistant") break;
            if (previous.kind === event.kind && sameMessage(previous, event)) {
              duplicate = true;
              break;
            }
          }
          if (duplicate) continue;
        }
        out.push(event);
      }
      return out;
    }
    function sameMessage(a, b) {
      if (a.content !== void 0 && b.content !== void 0) return a.content === b.content;
      return a.contentLength === b.contentLength && Boolean(a.contentHash) && a.contentHash === b.contentHash;
    }
    module2.exports = {
      parseTraceFile,
      parseTrace,
      norm,
      conversationEvents,
      hydrateEvent,
      hydrateEvents,
      copyEventCollection,
      jsonlLines,
      readLineRef,
      scan
    };
  }
});

// src/structured-data.js
var require_structured_data = __commonJS({
  "src/structured-data.js"(exports2, module2) {
    "use strict";
    var PAGE_SIZE = 80;
    var SEARCH_LIMIT = 150;
    var SEARCH_BUDGET = 5e4;
    function encodeSegment(value) {
      return String(value).replace(/~/g, "~0").replace(/\//g, "~1");
    }
    function decodeSegment(value) {
      return String(value).replace(/~1/g, "/").replace(/~0/g, "~");
    }
    function appendPointer(pointer, key) {
      return pointer + "/" + encodeSegment(key);
    }
    function resolvePointer(root, pointer) {
      if (!pointer) return root;
      if (pointer[0] !== "/") return void 0;
      let value = root;
      for (const fragment of pointer.slice(1).split("/")) {
        const key = decodeSegment(fragment);
        if (value === null || typeof value !== "object" || !Object.prototype.hasOwnProperty.call(value, key)) return void 0;
        value = value[key];
      }
      return value;
    }
    function kindOf(value) {
      if (value === null) return "null";
      if (Array.isArray(value)) return "array";
      return typeof value;
    }
    function preview(value, maxChars = 180) {
      if (typeof value === "string") return value.replace(/\s+/g, " ").slice(0, maxChars);
      if (value === null || typeof value !== "object") return String(value);
      return Array.isArray(value) ? "Array (" + value.length + ")" : "Object (" + Object.keys(value).length + ")";
    }
    function searchValue(root, query, options = {}) {
      const needle = String(query || "").trim().toLocaleLowerCase();
      if (!needle) return { matches: [], visited: 0, truncated: false };
      const limit = Math.max(1, options.limit || SEARCH_LIMIT);
      const budget = Math.max(1, options.budget || SEARCH_BUDGET);
      const stack = [{ value: root, path: "", key: "root" }];
      const matches = [];
      let visited = 0;
      while (stack.length && visited < budget && matches.length < limit) {
        const node = stack.pop();
        visited += 1;
        const value = node.value;
        const scalar = value === null || typeof value !== "object";
        const text = scalar ? preview(value, 600) : "";
        if (!scalar) {
          const entries = Object.entries(value);
          for (let i = entries.length - 1; i >= 0; i -= 1) {
            const entry = entries[i];
            stack.push({ value: entry[1], key: entry[0], path: appendPointer(node.path, entry[0]) });
          }
        }
        if ([node.key, node.path, text].some((part) => String(part).toLocaleLowerCase().includes(needle))) {
          matches.push({ path: node.path, key: node.key, type: kindOf(value), preview: preview(value) });
        }
      }
      return { matches, visited, truncated: stack.length > 0 };
    }
    function parseJsonlPage(lines, page, size = PAGE_SIZE) {
      const start = Math.max(0, page | 0) * size;
      const end = Math.min(lines.length, start + size);
      const records = [];
      for (let i = start; i < end; i += 1) {
        const line = lines[i];
        if (!line || !line.trim()) continue;
        try {
          records.push({ line: i + 1, value: JSON.parse(line) });
        } catch (error) {
          records.push({ line: i + 1, error: error.message, source: line });
        }
      }
      return { records, start, end, total: lines.length, more: end < lines.length };
    }
    function jsonErrorLocation(message, source) {
      const match = String(message).match(/position (\d+)/i);
      if (!match) return null;
      const pos = Number(match[1]);
      const before = source.slice(0, pos).split(/\r?\n/);
      return { line: before.length, column: before[before.length - 1].length + 1 };
    }
    module2.exports = { PAGE_SIZE, appendPointer, resolvePointer, kindOf, preview, searchValue, parseJsonlPage, jsonErrorLocation };
  }
});

// src/json-explorer.js
var require_json_explorer = __commonJS({
  "src/json-explorer.js"(exports2, module2) {
    "use strict";
    var { TextFileView, MarkdownRenderer, Notice, setIcon } = require("obsidian");
    var { PAGE_SIZE, appendPointer, resolvePointer, kindOf, preview, searchValue, parseJsonlPage, jsonErrorLocation } = require_structured_data();
    var CHILD_PAGE = 80;
    var RAW_PREVIEW = 25e4;
    function copyButton(parent, label, value) {
      const button = parent.createEl("button", { cls: "atr-data-action clickable-icon", attr: { type: "button", "aria-label": label, title: label } });
      setIcon(button, "copy");
      button.addEventListener("click", async (event) => {
        event.preventDefault();
        event.stopPropagation();
        try {
          const text = typeof value === "function" ? value() : value;
          if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) await navigator.clipboard.writeText(String(text));
          else {
            const node = document.createElement("textarea");
            node.value = String(text);
            node.style.position = "fixed";
            node.style.opacity = "0";
            document.body.appendChild(node);
            node.select();
            if (!document.execCommand("copy")) throw new Error("Clipboard unavailable");
            node.remove();
          }
          new Notice("Copied " + label.toLowerCase());
        } catch (error) {
          new Notice("Copy failed: " + error.message);
        }
      });
      return button;
    }
    function elementButton(parent, text, onClick, cls = "") {
      const button = parent.createEl("button", { cls: "atr-data-button " + cls, text, attr: { type: "button" } });
      button.addEventListener("click", onClick);
      return button;
    }
    function renderLongString(parent, value, view) {
      const box = parent.createEl("details", { cls: "atr-data-long" });
      box.createEl("summary", { text: "String \xB7 " + value.length.toLocaleString() + " characters \xB7 " + preview(value, 110) });
      const controls = box.createDiv({ cls: "atr-data-long-controls" });
      const content = box.createDiv({ cls: "atr-data-long-body" });
      const json = value.trim().startsWith("{") || value.trim().startsWith("[") ? tryJSON(value) : null;
      const tabs = ["Text", ...value.length <= 25e4 ? ["Markdown"] : [], ...json !== null ? ["JSON"] : []];
      let active = "Text", loaded = false;
      function render() {
        loaded = true;
        content.empty();
        controls.querySelectorAll("button.atr-data-button").forEach((node) => node.toggleClass("is-active", node.textContent === active));
        if (active === "Markdown" && view?.app) {
          const result = MarkdownRenderer.render(view.app, value, content, view.file?.path || "", view);
          if (result?.catch) result.catch(() => {
            content.empty();
            content.createEl("pre", { text: value });
          });
        } else if (active === "JSON" && json !== null) {
          renderJsonTree(content, json, "value", view);
        } else content.createEl("pre", { cls: "atr-data-text", text: value });
      }
      for (const tab of tabs) elementButton(controls, tab, () => {
        active = tab;
        render();
      }, tab === active ? "is-active" : "");
      copyButton(controls, "Copy string", () => value);
      box.addEventListener("toggle", () => {
        if (box.open && !loaded) render();
      });
    }
    function tryJSON(value) {
      try {
        return JSON.parse(value);
      } catch {
        return null;
      }
    }
    function renderJsonTree(parent, rootValue, label = "root", view = null, focusPath = "") {
      if (typeof label === "object" && label !== null) {
        focusPath = label.focusPath || "";
        view = label.view || null;
        label = label.label || "root";
      }
      const nodeRoot = parent.createDiv({ cls: "atr-data-tree" });
      const renderNode = (where, value, key, pointer, depth) => {
        const type = kindOf(value);
        const composite = type === "object" || type === "array";
        const row = where.createDiv({ cls: "atr-data-node" });
        if (focusPath === pointer) row.addClass("atr-data-selected");
        if (!composite) {
          const leaf = row.createDiv({ cls: "atr-data-leaf" });
          leaf.createSpan({ cls: "atr-data-key", text: String(key) });
          leaf.createSpan({ cls: "atr-data-kind", text: type });
          if (type === "string" && (value.length > 250 || value.includes("\n"))) {
            renderLongString(row, value, view);
          } else {
            leaf.createSpan({ cls: "atr-data-value", text: preview(value, 2e3) });
          }
          const actions2 = leaf.createSpan({ cls: "atr-data-actions" });
          copyButton(actions2, "Copy path", () => pointer || "/");
          copyButton(actions2, "Copy value", () => type === "string" ? value : JSON.stringify(value));
          return;
        }
        const collection = value;
        const keys = Object.keys(collection);
        const details = row.createEl("details", { cls: "atr-data-group" });
        const summary = details.createEl("summary", { cls: "atr-data-summary" });
        summary.createSpan({ cls: "atr-data-key", text: String(key) });
        summary.createSpan({ cls: "atr-data-kind", text: type });
        summary.createSpan({ cls: "atr-data-count", text: String(keys.length) + (type === "array" ? " items" : " keys") });
        const actions = summary.createSpan({ cls: "atr-data-actions" });
        copyButton(actions, "Copy path", () => pointer || "/");
        copyButton(actions, "Copy JSON", () => JSON.stringify(collection, null, 2));
        const children = details.createDiv({ cls: "atr-data-children" });
        let cursor = 0;
        const showNext = () => {
          const until = Math.min(cursor + CHILD_PAGE, keys.length);
          for (; cursor < until; cursor += 1) {
            const k = keys[cursor];
            renderNode(children, collection[k], k, appendPointer(pointer, k), depth + 1);
          }
          if (cursor < keys.length) {
            let more = children.querySelector(".atr-data-more");
            if (!more) more = elementButton(children, "", () => {
              more.remove();
              showNext();
            }, "atr-data-more");
            more.textContent = "Load next " + Math.min(CHILD_PAGE, keys.length - cursor) + " \xB7 " + (keys.length - cursor) + " remaining";
          }
        };
        details.addEventListener("toggle", () => {
          if (details.open && cursor === 0) showNext();
        });
        const isOnFocusPath = Boolean(focusPath && (pointer === "" || focusPath === pointer || focusPath.startsWith(pointer + "/")));
        if (pointer === "" && label !== "record" || isOnFocusPath) {
          details.open = true;
          const remainingPath = pointer ? focusPath.slice(pointer.length + 1) : focusPath.slice(1);
          const segment = remainingPath.split("/")[0].replace(/~1/g, "/").replace(/~0/g, "~");
          const targetIndex = isOnFocusPath && segment ? keys.indexOf(segment) : -1;
          if (targetIndex >= CHILD_PAGE) {
            cursor = keys.length;
            children.createDiv({ cls: "atr-data-focus-note", text: "Focused match at item " + (targetIndex + 1) + " / " + keys.length });
            renderNode(children, collection[segment], segment, appendPointer(pointer, segment), depth + 1);
            elementButton(children, "Browse this collection from the start", () => {
              children.empty();
              cursor = 0;
              showNext();
            });
          } else showNext();
        }
      };
      renderNode(nodeRoot, rootValue, label, "", 0);
      return nodeRoot;
    }
    var JsonView2 = class extends TextFileView {
      constructor(leaf) {
        super(leaf);
        this.data = "";
        this.page = 0;
        this.mode = "tree";
        this.query = "";
      }
      getViewType() {
        return "agent-trace-json";
      }
      getDisplayText() {
        return this.file?.basename || "JSON";
      }
      getIcon() {
        return "braces";
      }
      setViewData(data) {
        this.data = data;
        this.page = 0;
        this.render();
      }
      getViewData() {
        return this.data;
      }
      clear() {
        this.data = "";
        this.contentEl.empty();
      }
      render() {
        const root = this.contentEl;
        root.empty();
        root.addClass("atr-json");
        const header = root.createDiv({ cls: "atr-data-header" });
        const name = header.createDiv();
        name.createEl("h2", { text: this.file?.name || "Structured Data" });
        name.createDiv({ cls: "atr-data-subtitle", text: "Structured document \xB7 read-only" });
        copyButton(header, "Copy document", () => this.data);
        const controls = root.createDiv({ cls: "atr-data-toolbar" });
        elementButton(controls, "Tree", () => {
          this.mode = "tree";
          this.render();
        }, this.mode === "tree" ? "is-active" : "");
        elementButton(controls, "Raw", () => {
          this.mode = "raw";
          this.render();
        }, this.mode === "raw" ? "is-active" : "");
        const body = root.createDiv({ cls: "atr-data-document" });
        if (this.mode === "raw") {
          const snippet = this.data.length > RAW_PREVIEW ? this.data.slice(0, RAW_PREVIEW) : this.data;
          body.createEl("pre", { cls: "atr-data-text", text: snippet });
          if (this.data.length > RAW_PREVIEW) body.createDiv({ cls: "atr-data-notice", text: "Raw preview limited to 250,000 characters; Copy document includes the full content." });
          return;
        }
        const ext = this.file?.extension?.toLowerCase();
        if (ext === "jsonl" || ext === "ndjson") return this.renderJsonl(controls, body);
        this.renderSingle(controls, body);
      }
      renderSingle(controls, body) {
        let parsed;
        try {
          parsed = JSON.parse(this.data);
        } catch (error) {
          const position = jsonErrorLocation(error.message, this.data);
          const suffix = position ? " (line " + position.line + ", column " + position.column + ")" : "";
          body.createDiv({ cls: "atr-data-error", text: "Invalid JSON: " + error.message + suffix });
          body.createEl("pre", { cls: "atr-data-text", text: this.data.slice(0, 8e3) });
          return;
        }
        const search = controls.createEl("input", { cls: "atr-data-search", attr: { type: "search", placeholder: "Search keys, values, JSON Pointer\u2026", "aria-label": "Search JSON" } });
        search.value = this.query;
        const results = body.createDiv({ cls: "atr-data-search-results" });
        const tree = body.createDiv();
        const select = (pointer) => {
          tree.empty();
          renderJsonTree(tree, parsed, "root", this, pointer);
        };
        select("");
        const searchNow = () => {
          results.empty();
          this.query = search.value;
          if (!this.query.trim()) return;
          const found = searchValue(parsed, this.query);
          results.createDiv({ cls: "atr-data-result-count", text: found.matches.length + " matches" + (found.truncated ? " \xB7 limited results" : "") });
          for (const hit of found.matches) {
            const button = elementButton(results, (hit.path || "/") + " \xB7 " + hit.preview, () => select(hit.path), "atr-data-search-hit");
            button.title = hit.type;
          }
        };
        search.oninput = searchNow;
        searchNow();
      }
      renderJsonl(controls, body) {
        const lines = this.data.split(/\r?\n/);
        while (lines.length && !lines[lines.length - 1].trim()) lines.pop();
        const totalPages = Math.max(1, Math.ceil(lines.length / PAGE_SIZE));
        this.page = Math.min(this.page, totalPages - 1);
        const nav = controls.createDiv({ cls: "atr-data-pagination" });
        elementButton(nav, "\u2190 Previous", () => {
          this.page = Math.max(0, this.page - 1);
          this.render();
        }, this.page === 0 ? "is-disabled" : "");
        nav.createSpan({ text: "Page " + (this.page + 1) + " / " + totalPages });
        elementButton(nav, "Next \u2192", () => {
          this.page = Math.min(totalPages - 1, this.page + 1);
          this.render();
        }, this.page === totalPages - 1 ? "is-disabled" : "");
        const page = parseJsonlPage(lines, this.page, PAGE_SIZE);
        for (const record of page.records) {
          const section = body.createDiv({ cls: "atr-data-record" });
          section.createDiv({ cls: "atr-data-record-label", text: "Line " + record.line });
          if (record.error) {
            section.createDiv({ cls: "atr-data-error", text: record.error });
            section.createEl("pre", { cls: "atr-data-text", text: record.source.slice(0, 4e3) });
          } else renderJsonTree(section, record.value, "record", this);
        }
        body.createDiv({ cls: "atr-data-subtitle", text: lines.length.toLocaleString() + " source lines \xB7 parsed one page at a time" });
      }
    };
    module2.exports = { JsonView: JsonView2, renderJsonTree };
  }
});

// src/trace-model.js
var require_trace_model = __commonJS({
  "src/trace-model.js"(exports2, module2) {
    "use strict";
    function timestampMs(event) {
      const time = event?.timestamp ? Date.parse(event.timestamp) : NaN;
      return Number.isFinite(time) ? time : null;
    }
    function pairCalls(events) {
      const waiting = /* @__PURE__ */ new Map();
      const pairs = /* @__PURE__ */ new Map();
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
      let turnNumber = 0;
      let active = { id: "setup", label: "Session setup", events: [], number: 0 };
      for (const event of events) {
        if (event.kind === "user" && !event.bootstrap) {
          if (active.events.length) groups.push(active);
          turnNumber += 1;
          active = { id: "turn-" + turnNumber, label: "Turn " + turnNumber, events: [], number: turnNumber };
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
        if (t !== null) {
          min = Math.min(min, t);
          max = Math.max(max, t);
        }
      }
      return Number.isFinite(min) ? { start: min, end: max, range: Math.max(1, max - min) } : null;
    }
    function eventTimeline(event, paired, bounds) {
      if (!bounds) return null;
      const start = timestampMs(event);
      if (start === null) return null;
      const end = paired?.call === event && paired.durationMs !== null ? timestampMs(paired.result) : null;
      return {
        left: Math.max(0, Math.min(100, (start - bounds.start) / bounds.range * 100)),
        width: end === null ? 0 : Math.max(0, Math.min(100, (end - start) / bounds.range * 100)),
        durationMs: end === null ? null : end - start
      };
    }
    function durationText(ms) {
      if (ms === null || ms === void 0) return "duration unavailable";
      if (ms < 1e3) return Math.round(ms) + " ms";
      if (ms < 6e4) return (ms / 1e3).toFixed(2) + " s";
      return (ms / 6e4).toFixed(1) + " min";
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
      return events.filter((event) => {
        if (kind && kind !== "all" && event.kind !== kind) return false;
        return !q || [event.kind, event.title, event.sourceSubtype, event.preview, event.callId].some((v) => String(v || "").toLocaleLowerCase().includes(q));
      });
    }
    module2.exports = { timestampMs, pairCalls, projectTurns, timelineBounds, eventTimeline, durationText, eventLabel, searchEvents };
  }
});

// src/trace-explorer.js
var require_trace_explorer = __commonJS({
  "src/trace-explorer.js"(exports2, module2) {
    "use strict";
    var { MarkdownRenderer, setIcon } = require("obsidian");
    var { hydrateEvent } = require_codex();
    var { renderJsonTree } = require_json_explorer();
    var { projectTurns, pairCalls, timelineBounds, eventTimeline, durationText, eventLabel, searchEvents } = require_trace_model();
    var BATCH = 120;
    function hasReadableContent(event) {
      const length = Number(event?.contentLength);
      if (Number.isFinite(length)) {
        if (length <= 0) return false;
        return event.preview === void 0 || String(event.preview).trim().length > 0;
      }
      return String(event?.preview || event?.content || "").trim().length > 0;
    }
    function renderTraceExplorer(parent, trace, view) {
      const events = trace.events || [];
      const pairs = pairCalls(events);
      const bounds = timelineBounds(events);
      const groups = projectTurns(events);
      const wrap = parent.createDiv({ cls: "atr-explorer" });
      const summary = wrap.createDiv({ cls: "atr-explorer-summary" });
      summary.createSpan({ text: events.length.toLocaleString() + " events" });
      summary.createSpan({ text: groups.filter((group) => group.number).length + " turns" });
      summary.createSpan({ text: events.filter((event) => event.kind === "tool-call").length + " tools" });
      summary.createSpan({ text: Math.floor(pairs.size / 2) + " paired calls" });
      if (trace.errors.length) summary.createSpan({ cls: "atr-explorer-warning", text: trace.errors.length + " malformed lines" });
      const toolbar = wrap.createDiv({ cls: "atr-explorer-toolbar" });
      const search = toolbar.createEl("input", { cls: "atr-explorer-search", attr: { type: "search", placeholder: "Filter event type, tool name, text\u2026", "aria-label": "Search events" } });
      const select = toolbar.createEl("select", { cls: "atr-explorer-filter", attr: { "aria-label": "Filter event type" } });
      const kinds = ["all", "user", "assistant", "tool-call", "tool-result", "reasoning", "event", "metadata", "unknown"];
      for (const kind of kinds) {
        const count = kind === "all" ? events.length : events.filter((event) => event.kind === kind).length;
        const option = select.createEl("option", { text: `${kind === "all" ? "All types" : kind} (${count.toLocaleString()})` });
        option.value = kind;
      }
      const emptyToggle = toolbar.createEl("label", { cls: "atr-explorer-empty-toggle" });
      const includeEmpty = emptyToggle.createEl("input", { attr: { type: "checkbox", "aria-label": "Include records with no readable content" } });
      emptyToggle.createSpan({ text: "Include empty" });
      const emptyToggleCount = emptyToggle.createSpan({ cls: "atr-explorer-empty-count" });
      const filterStatus = toolbar.createSpan({ cls: "atr-explorer-filter-status" });
      const layout = wrap.createDiv({ cls: "atr-explorer-layout" });
      const treePanel = layout.createDiv({ cls: "atr-explorer-tree" });
      const inspector = layout.createDiv({ cls: "atr-explorer-inspector" });
      let current = events.find((event) => event.kind === "user" && !event.bootstrap && hasReadableContent(event)) || events.find(hasReadableContent) || events[0] || null;
      function inspect(event) {
        current = event;
        inspector.empty();
        if (!event) {
          inspector.createDiv({ cls: "atr-explorer-empty", text: "Select an event to inspect the original evidence." });
          return;
        }
        const head = inspector.createDiv({ cls: "atr-explorer-inspector-head" });
        head.createEl("h3", { text: eventLabel(event) });
        const meta = head.createDiv({ cls: "atr-explorer-inspector-meta" });
        meta.createSpan({ text: event.kind });
        meta.createSpan({ text: "line " + (event.lineNumber || "\u2014") });
        if (event.timestamp) meta.createSpan({ text: event.timestamp });
        if (event.callId) meta.createSpan({ text: "call " + event.callId });
        const pair = pairs.get(event.index);
        if (pair && pair.call === event) {
          meta.createSpan({ text: "Observed " + durationText(pair.durationMs) });
          const related = head.createEl("button", { cls: "atr-explorer-jump", text: "View tool result", attr: { type: "button" } });
          related.onclick = () => inspect(pair.result);
        } else if (pair && pair.result === event) {
          const related = head.createEl("button", { cls: "atr-explorer-jump", text: "View tool call", attr: { type: "button" } });
          related.onclick = () => inspect(pair.call);
        }
        if (event.explicitError) meta.createSpan({ cls: "atr-explorer-warning", text: "Explicit error" });
        const tabs = head.createDiv({ cls: "atr-explorer-inspector-tabs" });
        const body = inspector.createDiv({ cls: "atr-explorer-inspector-content" });
        const renderTab = (mode) => {
          body.empty();
          tabs.querySelectorAll("button").forEach((button) => button.toggleClass("is-active", button.textContent === mode));
          let hydrated;
          try {
            hydrated = hydrateEvent(event);
          } catch (error) {
            body.createDiv({ cls: "atr-data-error", text: "Trace data unavailable: " + error.message });
            return;
          }
          if (mode === "Content") {
            if (hydrated.content === void 0) body.createDiv({ cls: "atr-explorer-empty", text: "No text content. See Fields for the full event." });
            else body.createEl("pre", { cls: "atr-explorer-text", text: hydrated.content });
          } else if (mode === "Fields") {
            renderJsonTree(body, hydrated.raw === void 0 ? hydrated : hydrated.raw, "event", view);
          } else if (mode === "Raw") {
            body.createEl("pre", { cls: "atr-explorer-text", text: JSON.stringify(hydrated.raw === void 0 ? hydrated : hydrated.raw, null, 2) });
          } else if (mode === "Markdown") {
            if (!hydrated.content) {
              body.createDiv({ cls: "atr-explorer-empty", text: "No Markdown content is available for this event." });
            } else {
              const result = MarkdownRenderer.render(view.app, hydrated.content, body, "", view);
              if (result?.catch) result.catch((error) => body.createDiv({ cls: "atr-data-error", text: error.message }));
            }
          }
        };
        for (const tab of ["Markdown", "Content", "Fields", "Raw"]) {
          const button = tabs.createEl("button", { cls: "atr-explorer-tab", text: tab, attr: { type: "button" } });
          button.onclick = () => renderTab(tab);
        }
        renderTab("Markdown");
      }
      function drawList() {
        treePanel.empty();
        const q = search.value, kind = select.value;
        let visible = 0;
        let emptyCount = 0;
        for (const group of groups) {
          const candidates = searchEvents(group.events, q, kind);
          const empty = candidates.filter((event) => !hasReadableContent(event));
          emptyCount += empty.length;
          const matching = includeEmpty.checked ? candidates : candidates.filter(hasReadableContent);
          if (!matching.length) continue;
          visible += matching.length;
          const section = treePanel.createEl("details", { cls: "atr-explorer-turn", attr: { open: "" } });
          const turnHead = section.createEl("summary", { cls: "atr-explorer-turn-heading" });
          turnHead.createSpan({ text: group.label });
          turnHead.createSpan({ cls: "atr-explorer-turn-count", text: matching.length.toLocaleString() });
          const list = section.createDiv({ cls: "atr-explorer-items" });
          let cursor = 0;
          const loadNext = () => {
            const end = Math.min(cursor + BATCH, matching.length);
            for (; cursor < end; cursor++) {
              const event = matching[cursor], pair = pairs.get(event.index);
              const row = list.createEl("button", { cls: "atr-explorer-row", attr: { type: "button" } });
              if (current === event) row.addClass("is-active");
              const line = row.createDiv({ cls: "atr-explorer-row-line" });
              line.createSpan({ cls: "atr-explorer-kind atr-explorer-kind-" + event.kind, text: event.kind });
              line.createSpan({ cls: "atr-explorer-label", text: eventLabel(event) });
              if (pair && pair.call === event && pair.durationMs !== null) line.createSpan({ cls: "atr-explorer-duration", text: durationText(pair.durationMs) });
              if (event.explicitError || pair?.explicitError && pair.call === event) line.createSpan({ cls: "atr-explorer-warning", text: "error" });
              const meta = row.createDiv({ cls: "atr-explorer-row-meta" });
              meta.createSpan({ cls: "atr-explorer-row-time", text: event.timestamp ? event.timestamp.slice(11, 23) : "no timestamp" });
              if (event.lineNumber) meta.createSpan({ cls: "atr-explorer-row-line-number", text: "line " + event.lineNumber });
              if (event.callId) meta.createSpan({ cls: "atr-explorer-row-call-id", text: "call " + event.callId });
              if (event.hasContent && event.preview) {
                row.createDiv({ cls: "atr-explorer-preview", text: event.preview.slice(0, 220) });
              }
              const visual = eventTimeline(event, pair, bounds);
              if (visual) {
                const track = row.createDiv({ cls: "atr-explorer-track" });
                const bar = track.createDiv({ cls: "atr-explorer-bar" + (visual.durationMs !== null ? " has-span" : "") });
                bar.style.left = visual.left + "%";
                bar.style.width = Math.max(0.8, visual.width) + "%";
                bar.title = visual.durationMs !== null ? "Observed tool interval: " + durationText(visual.durationMs) : "Event timestamp";
              }
              row.onclick = () => {
                treePanel.querySelectorAll(".atr-explorer-row.is-active").forEach((node) => node.removeClass("is-active"));
                row.addClass("is-active");
                inspect(event);
              };
            }
            const old = list.querySelector(".atr-explorer-more");
            if (old) old.remove();
            if (cursor < matching.length) {
              const more = list.createEl("button", { cls: "atr-explorer-more", text: "Load " + Math.min(BATCH, matching.length - cursor) + " more events", attr: { type: "button" } });
              more.onclick = loadNext;
            }
          };
          loadNext();
        }
        emptyToggleCount.textContent = `(${emptyCount.toLocaleString()})`;
        filterStatus.textContent = includeEmpty.checked ? `${visible.toLocaleString()} shown` : `${visible.toLocaleString()} shown \xB7 ${emptyCount.toLocaleString()} empty hidden`;
        if (!visible) {
          const message = !includeEmpty.checked && emptyCount ? `${emptyCount.toLocaleString()} matching records have no readable content. Enable \u201CInclude empty\u201D to inspect their fields.` : "No matching trace events.";
          treePanel.createDiv({ cls: "atr-explorer-empty", text: message });
        }
      }
      search.oninput = drawList;
      select.onchange = drawList;
      includeEmpty.onchange = drawList;
      inspect(current);
      drawList();
    }
    module2.exports = { renderTraceExplorer };
  }
});

// src/views.js
var require_views = __commonJS({
  "src/views.js"(exports2, module2) {
    var {
      ItemView,
      PluginSettingTab,
      Setting,
      MarkdownRenderer,
      Notice,
      setIcon
    } = require("obsidian");
    var fs = require("fs");
    var shared = require_shared();
    var source = require_codex();
    var { JsonView: JsonView2, renderJsonTree } = require_json_explorer();
    var { renderTraceExplorer } = require_trace_explorer();
    var {
      VS: VS2,
      VT: VT2,
      VJ: VJ2,
      SMART,
      MDMAX,
      JLIM,
      RAW_PAGE_SIZE,
      PROCESS_PAGE_SIZE,
      DEFAULT_CODEX_HOME,
      obj,
      err,
      home,
      dir,
      fileStamp,
      sameStamp,
      basename,
      short,
      displaySessionTitle,
      cap,
      fmt,
      time,
      day,
      looksMd,
      tryJson,
      formatBytes,
      formatChars,
      filterSessions
    } = shared;
    var {
      parseTraceFile,
      conversationEvents,
      hydrateEvent,
      copyEventCollection,
      readLineRef,
      scan
    } = source;
    var Settings2 = class extends PluginSettingTab {
      constructor(app, plugin) {
        super(app, plugin);
        this.p = plugin;
      }
      display() {
        const el = this.containerEl;
        el.empty();
        el.createEl("h2", { text: "Agent Trace Reader" });
        new Setting(el).setName("Codex home").setDesc("Reads sessions/ and archived_sessions/ under this folder. Read-only; nothing is copied into the vault.").addText(
          (text) => text.setValue(this.p.settings.codexHomePath).onChange(async (value) => {
            const next = value.trim();
            if (!next) return;
            this.p.settings.codexHomePath = home(next);
            await this.p.save();
          })
        );
        new Setting(el).setName("Maximum sessions").setDesc("Limit the number of sessions shown after scanning the folder.").addText(
          (text) => text.setValue(String(this.p.settings.maxSessions)).onChange(async (value) => {
            const next = parseInt(value, 10);
            if (next > 0) {
              this.p.settings.maxSessions = Math.min(next, 5e3);
              await this.p.save();
            }
          })
        );
        new Setting(el).setName("Compact conversation").setDesc("Collapse system/tool/reasoning traffic into Process blocks.").addToggle(
          (toggle) => toggle.setValue(this.p.settings.compactConversation).onChange(async (value) => {
            this.p.settings.compactConversation = value;
            await this.p.save();
          })
        );
      }
    };
    var Sessions2 = class extends ItemView {
      constructor(leaf, plugin) {
        super(leaf);
        this.p = plugin;
        this.sessions = null;
        this.query = "";
      }
      getViewType() {
        return VS2;
      }
      getDisplayText() {
        return "Agent sessions";
      }
      getIcon() {
        return "messages-square";
      }
      async onOpen() {
        await this.render(true);
      }
      async render(forceScan = false) {
        const rootEl = this.contentEl;
        rootEl.empty();
        rootEl.addClass("atr-sessions");
        const header = rootEl.createDiv({ cls: "atr-header" });
        const heading = header.createDiv();
        heading.createEl("h2", { text: "Agent Sessions" });
        heading.createDiv({ cls: "atr-muted", text: "Codex \xB7 local, read-only" });
        const tools = header.createDiv({ cls: "atr-session-tools" });
        const search = tools.createEl("input", {
          cls: "atr-session-search",
          attr: {
            type: "search",
            placeholder: "Search title, cwd, id, or path",
            "aria-label": "Search sessions"
          }
        });
        search.value = this.query;
        const refresh = btn(tools, "refresh-cw", "Refresh");
        refresh.onclick = () => this.render(true);
        const root = home(this.p.settings.codexHomePath || DEFAULT_CODEX_HOME);
        const source2 = rootEl.createDiv({ cls: "atr-source" });
        source2.createSpan({ text: root });
        copyButton(source2, "Copy Codex home", () => root, { text: "Copy path" });
        if (!dir(root)) {
          this.sessions = null;
          rootEl.createDiv({
            cls: "atr-empty-card",
            text: "Codex home not found. Set it in Settings \u2192 Agent Trace Reader."
          });
          return;
        }
        let sessions = this.sessions;
        if (forceScan || !sessions) {
          try {
            sessions = await scan(root, this.p.settings.maxSessions);
            this.sessions = sessions;
          } catch (error) {
            this.sessions = null;
            rootEl.createDiv({ cls: "atr-error", text: `Scan failed: ${err(error)}` });
            return;
          }
        }
        const results = rootEl.createDiv({ cls: "atr-session-results" });
        search.oninput = () => {
          this.query = search.value;
          this.renderResults(results, this.sessions || []);
        };
        this.renderResults(results, sessions);
      }
      renderResults(parent, sessions) {
        parent.empty();
        const filtered = filterSessions(sessions, this.query);
        if (!sessions.length) {
          parent.createDiv({ cls: "atr-empty-card", text: "No rollout-*.jsonl files found." });
          return;
        }
        if (!filtered.length) {
          parent.createDiv({ cls: "atr-empty-card", text: `No sessions match \u201C${this.query.trim()}\u201D.` });
          return;
        }
        const titleCounts = /* @__PURE__ */ new Map();
        for (const session of sessions) {
          const title = session.title || "Untitled session";
          titleCounts.set(title, (titleCounts.get(title) || 0) + 1);
        }
        let sectionIndex = 0;
        for (const [label, items] of groups(filtered)) {
          const sectionClass = `atr-session-section atr-session-section-${label.toLowerCase()}${sectionIndex === 0 ? " atr-session-section-first" : ""}`;
          const section = parent.createDiv({ cls: sectionClass });
          const sectionHeader = section.createDiv({ cls: "atr-session-section-header" });
          sectionHeader.createEl("h3", { text: label });
          sectionHeader.createSpan({
            cls: "atr-session-count",
            text: `${items.length.toLocaleString()} session${items.length === 1 ? "" : "s"}`
          });
          for (const session of items) {
            const row = section.createDiv({ cls: "atr-session-row" });
            const cardEl = row.createEl("button", {
              cls: "atr-session-card",
              attr: { type: "button" }
            });
            const title = displaySessionTitle(session, titleCounts);
            cardEl.createDiv({ cls: "atr-session-title", text: title });
            const meta = cardEl.createDiv({ cls: "atr-session-meta" });
            meta.createSpan({ cls: "atr-session-date", text: fmt(session.modifiedMs) });
            if (session.archived) meta.createSpan({ cls: "atr-session-archived", text: "Archived" });
            if (session.cwd) meta.createSpan({ cls: "atr-session-cwd", text: session.cwd });
            if (session.sessionId) meta.createSpan({ cls: "atr-session-id", text: short(session.sessionId) });
            cardEl.onclick = () => this.p.openTrace(session.filePath);
            copyButton(row, "Copy trace path", () => session.filePath);
          }
          sectionIndex += 1;
        }
      }
    };
    var Trace2 = class extends ItemView {
      constructor(leaf, plugin) {
        super(leaf);
        this.p = plugin;
        this.filePath = "";
        this.tab = "conversation";
        this.trace = null;
        this.loadSerial = 0;
        this.loading = false;
        this.autoFollow = false;
        this.changed = false;
        this.fileWatcher = null;
        this.watchTimer = null;
        this.fileStamp = null;
      }
      getViewType() {
        return VT2;
      }
      getDisplayText() {
        return this.trace?.title || basename(this.filePath) || "Agent trace";
      }
      getIcon() {
        return "messages-square";
      }
      async setState(state, result) {
        await super.setState(state, result);
        if (this.filePath && state?.filePath !== this.filePath) this.stopWatching();
        this.filePath = state && typeof state.filePath === "string" ? state.filePath : "";
        await this.load();
      }
      getState() {
        return { filePath: this.filePath };
      }
      async onOpen() {
        if (this.filePath) await this.load();
      }
      async onClose() {
        this.stopWatching();
      }
      async load() {
        const serial = ++this.loadSerial;
        this.loading = true;
        this.contentEl.empty();
        this.contentEl.addClass("atr-trace");
        this.contentEl.createDiv({ cls: "atr-loading", text: "Loading trace\u2026" });
        try {
          const trace = await parseTraceFile(this.filePath);
          if (serial !== this.loadSerial) return;
          this.trace = trace;
          this.loading = false;
          this.changed = false;
          this.render();
          this.startWatching();
        } catch (error) {
          if (serial !== this.loadSerial) return;
          this.loading = false;
          this.trace = null;
          this.contentEl.empty();
          this.contentEl.addClass("atr-trace");
          this.contentEl.createDiv({ cls: "atr-error", text: `Could not read trace: ${err(error)}` });
        }
      }
      render() {
        const rootEl = this.contentEl;
        rootEl.empty();
        rootEl.addClass("atr-trace");
        const trace = this.trace;
        if (!trace) return;
        const header = rootEl.createDiv({ cls: "atr-trace-header" });
        const heading = header.createDiv({ cls: "atr-trace-heading" });
        heading.createEl("h2", { text: trace.title || basename(this.filePath) });
        const meta = heading.createDiv({ cls: "atr-trace-meta" });
        if (trace.cwd) meta.createSpan({ text: trace.cwd });
        if (trace.sessionId) meta.createSpan({ text: short(trace.sessionId) });
        meta.createSpan({ text: `${trace.lineCount.toLocaleString()} lines` });
        if (trace.isLarge) meta.createSpan({ text: `${formatBytes(trace.fileSize)} \xB7 streamed` });
        copyButton(meta, "Copy trace path", () => this.filePath);
        const controls = header.createDiv({ cls: "atr-trace-controls" });
        const refresh = btn(controls, "refresh-cw", "Refresh trace");
        refresh.disabled = this.loading;
        refresh.onclick = () => this.load();
        const follow = btn(controls, "radio", "Auto-follow trace");
        follow.addClass("atr-follow-toggle");
        follow.createSpan({ text: "Auto" });
        follow.toggleClass("is-active", this.autoFollow);
        follow.onclick = () => {
          this.autoFollow = !this.autoFollow;
          const refreshNow = this.autoFollow && this.changed;
          this.render();
          if (refreshNow) this.load();
        };
        const tabs = controls.createDiv({ cls: "atr-tabs" });
        for (const tab of ["conversation", "explorer", "trajectory", "raw"]) {
          const tabEl = tabs.createEl("button", {
            cls: `atr-tab${this.tab === tab ? " is-active" : ""}`,
            text: cap(tab)
          });
          tabEl.onclick = () => {
            this.tab = tab;
            this.render();
          };
        }
        if (trace.errors.length) {
          rootEl.createDiv({
            cls: "atr-warning",
            text: `${trace.errors.length} malformed JSONL line(s); Raw remains available.`
          });
        }
        if (this.changed) {
          rootEl.createDiv({ cls: "atr-trace-changed", text: "Trace changed on disk. Refresh to read the new records." });
        }
        if (trace.isLarge) {
          rootEl.createDiv({
            cls: "atr-note",
            text: "Large trace: records and raw evidence load in pages; expanding an event reads only that line."
          });
        }
        const body = rootEl.createDiv({ cls: "atr-trace-body" });
        if (this.tab === "conversation") this.convo(body, trace.events);
        else if (this.tab === "explorer") renderTraceExplorer(body, trace, this);
        else if (this.tab === "trajectory") this.traj(body, trace.events);
        else rawView(body, trace);
      }
      convo(parent, events) {
        const use = conversationEvents(events);
        if (!use.length) {
          parent.createDiv({
            cls: "atr-empty-card",
            text: "No conversation events recognized. Use Trajectory or Raw."
          });
          return;
        }
        let process2 = [];
        const flush = () => {
          if (!process2.length) return;
          processBlock(parent, process2, this, this.p.settings.compactConversation);
          process2 = [];
        };
        for (const event of use) {
          if (event.kind === "user" || event.kind === "assistant") {
            flush();
            card(parent, event, this);
          } else {
            process2.push(event);
          }
        }
        flush();
      }
      traj(parent, events) {
        const list = parent.createDiv({ cls: "atr-event-list" });
        let cursor = 0;
        const more = parent.createEl("button", {
          cls: "atr-load-more",
          attr: { type: "button" }
        });
        const updateMore = () => {
          const remaining = events.length - cursor;
          if (!remaining) {
            more.remove();
            return;
          }
          more.textContent = `Load next ${Math.min(PROCESS_PAGE_SIZE, remaining).toLocaleString()} events \xB7 ${remaining.toLocaleString()} remaining`;
        };
        const renderNext = () => {
          const end = Math.min(cursor + PROCESS_PAGE_SIZE, events.length);
          for (; cursor < end; cursor += 1) eventRow(list, events[cursor], this);
          updateMore();
        };
        more.onclick = renderNext;
        renderNext();
      }
      startWatching() {
        this.stopWatching();
        if (!this.filePath || typeof fs.watch !== "function") return;
        this.fileStamp = fileStamp(this.filePath);
        try {
          this.fileWatcher = fs.watch(this.filePath, { persistent: false }, () => this.queueFileChange());
          this.fileWatcher.on("error", () => this.stopWatching());
        } catch {
          this.fileWatcher = null;
        }
      }
      stopWatching() {
        if (this.watchTimer) {
          clearTimeout(this.watchTimer);
          this.watchTimer = null;
        }
        if (this.fileWatcher) {
          this.fileWatcher.close();
          this.fileWatcher = null;
        }
      }
      queueFileChange() {
        if (this.watchTimer) clearTimeout(this.watchTimer);
        this.watchTimer = setTimeout(() => {
          this.watchTimer = null;
          const next = fileStamp(this.filePath);
          if (!next || sameStamp(next, this.fileStamp)) return;
          this.fileStamp = next;
          this.changed = true;
          if (this.autoFollow && !this.loading) this.load();
          else if (!this.loading && this.trace) this.showChangedNotice();
        }, 180);
      }
      showChangedNotice() {
        if (this.contentEl.querySelector(".atr-trace-changed")) return;
        const body = this.contentEl.querySelector(".atr-trace-body");
        const notice = this.contentEl.createDiv({
          cls: "atr-trace-changed",
          text: "Trace changed on disk. Refresh to read the new records."
        });
        if (body) body.before(notice);
      }
    };
    function processBlock(parent, events, comp, compact) {
      const details = parent.createEl("details", { cls: "atr-process" });
      if (!compact) details.open = true;
      const summary = details.createEl("summary");
      summary.createSpan({
        cls: "atr-process-label",
        text: `Process \xB7 ${events.length.toLocaleString()} event${events.length === 1 ? "" : "s"}`
      });
      copyButton(summary, "Copy process", () => copyEventCollection(events));
      let cursor = 0;
      let body;
      let more;
      const renderNext = () => {
        if (!body) body = details.createDiv({ cls: "atr-process-events" });
        const end = Math.min(cursor + PROCESS_PAGE_SIZE, events.length);
        for (; cursor < end; cursor += 1) card(body, events[cursor], comp);
        if (cursor < events.length) {
          if (!more) {
            more = body.createEl("button", {
              cls: "atr-load-more",
              attr: { type: "button" }
            });
            more.onclick = renderNext;
          }
          const remaining = events.length - cursor;
          more.textContent = `Load next ${Math.min(PROCESS_PAGE_SIZE, remaining).toLocaleString()} process events \xB7 ${remaining.toLocaleString()} remaining`;
        } else if (more) {
          more.remove();
        }
      };
      details.addEventListener("toggle", () => {
        if (details.open && cursor === 0) renderNext();
      });
      if (!compact) renderNext();
    }
    function card(parent, event, comp) {
      const cardEl = parent.createDiv({ cls: `atr-message atr-message-${event.kind}` });
      const header = cardEl.createDiv({ cls: "atr-message-header" });
      const headerMain = header.createDiv({ cls: "atr-message-header-main" });
      headerMain.createSpan({ cls: "atr-message-role", text: (event.role || event.kind).toUpperCase() });
      if (event.timestamp) headerMain.createSpan({ cls: "atr-message-time", text: time(event.timestamp) });
      copyButton(header, "Copy message", () => eventCopyText(event));
      if (event.content !== void 0) {
        const body = cardEl.createDiv({ cls: "atr-message-body" });
        messageBody(body, event.content, comp);
      } else if (event.hasContent) {
        lazyMessageBody(cardEl, event, comp);
      } else {
        cardEl.createDiv({ cls: "atr-muted", text: event.title });
      }
    }
    function lazyMessageBody(parent, event, comp) {
      const details = parent.createEl("details", { cls: "atr-lazy-content" });
      const summary = details.createEl("summary");
      summary.createSpan({ text: `${formatChars(event.contentLength)} \xB7 Expand to load` });
      if (event.preview) summary.createSpan({ cls: "atr-lazy-preview", text: ` \xB7 ${event.preview}` });
      const body = details.createDiv({ cls: "atr-message-body" });
      let loaded = false;
      details.addEventListener("toggle", () => {
        if (!details.open || loaded) return;
        loaded = true;
        try {
          const hydrated = hydrateEvent(event);
          if (hydrated && hydrated.content !== void 0) {
            messageBody(body, hydrated.content, comp);
          } else {
            body.createDiv({ cls: "atr-muted", text: "No displayable text in this event." });
          }
        } catch (error) {
          body.createDiv({ cls: "atr-error", text: `Could not load event: ${err(error)}` });
        }
      });
    }
    function messageBody(parent, value, comp) {
      if (value.length <= MDMAX && looksMd(value)) {
        MarkdownRenderer.render(comp.app, value, parent, "", comp).catch(() => {
          parent.empty();
          parent.createDiv({ cls: "atr-message-text", text: value });
        });
      } else {
        parent.createDiv({ cls: "atr-message-text", text: value });
      }
    }
    function eventRow(parent, event, comp) {
      const details = parent.createEl("details", { cls: `atr-trajectory-row atr-kind-${event.kind}` });
      const summary = details.createEl("summary");
      summary.createSpan({ cls: "atr-event-index", text: String(event.index + 1).padStart(3, "0") });
      summary.createSpan({ cls: "atr-event-time", text: event.timestamp ? time(event.timestamp) : "\u2014" });
      summary.createSpan({ cls: "atr-event-kind", text: event.kind });
      const title = event.hasContent && event.content === void 0 ? `${event.title} \xB7 ${formatChars(event.contentLength)}` : event.title;
      summary.createSpan({ cls: "atr-event-title", text: title });
      const copy = copyButton(summary, "Copy event", () => eventCopyText(event));
      copy.addClass("atr-event-copy");
      const content = details.createDiv({ cls: "atr-event-details" });
      let loaded = false;
      details.addEventListener("toggle", () => {
        if (!details.open || loaded) return;
        loaded = true;
        renderEventDetails(content, event, comp);
      });
    }
    function renderEventDetails(parent, event, comp) {
      try {
        const hydrated = hydrateEvent(event);
        if (!hydrated) {
          parent.createDiv({ cls: "atr-muted", text: "Event record is unavailable." });
          return;
        }
        if (hydrated.content !== void 0) smart(parent, hydrated.content, comp);
        if (hydrated.raw !== void 0) renderJsonTree(parent, hydrated.raw, "raw", comp);
      } catch (error) {
        parent.createDiv({ cls: "atr-error", text: `Could not load event: ${err(error)}` });
      }
    }
    function smart(parent, value, comp) {
      const details = parent.createEl("details", { cls: "atr-smart-string" });
      const summary = details.createEl("summary");
      summary.createSpan({ text: `${value.length.toLocaleString()} chars` });
      const bar = details.createDiv({ cls: "atr-smart-tabs" });
      const output = details.createDiv({ cls: "atr-smart-content" });
      const parsed = tryJson(value);
      const markdown = value.length <= MDMAX && looksMd(value);
      const modes = [...markdown ? ["Rendered"] : [], "Text", "Raw", ...parsed !== null ? ["JSON"] : []];
      let active = markdown ? "Rendered" : "Text";
      let rendered = false;
      const render = (mode) => {
        active = mode;
        rendered = true;
        bar.querySelectorAll("button").forEach((button) => button.toggleClass("is-active", button.textContent === mode));
        output.empty();
        if (mode === "Rendered") {
          MarkdownRenderer.render(comp.app, value, output, "", comp).catch(() => {
            output.empty();
            output.createEl("pre", { cls: "atr-plain-text", text: value });
          });
        } else if (mode === "Text") {
          output.createEl("pre", { cls: "atr-plain-text", text: value });
        } else if (mode === "Raw") {
          output.createEl("pre", { cls: "atr-plain-text", text: JSON.stringify(value) });
        } else {
          renderJsonTree(output, parsed, "root", comp);
        }
      };
      for (const mode of modes) {
        const button = bar.createEl("button", { cls: "atr-mini-tab", text: mode });
        button.onclick = (event) => {
          event.preventDefault();
          event.stopPropagation();
          render(mode);
        };
      }
      copyButton(bar, "Copy string", () => value);
      details.addEventListener("toggle", () => {
        if (details.open && !rendered) render(active);
      });
    }
    function rawView(parent, trace) {
      const wrap = parent.createDiv({ cls: "atr-raw-view" });
      const info = wrap.createDiv({
        cls: "atr-raw-info",
        text: `${trace.lineCount.toLocaleString()} lines \xB7 paged read-only evidence`
      });
      if (trace.filePath) info.setAttribute("title", trace.filePath);
      const controls = wrap.createDiv({ cls: "atr-raw-controls" });
      const loadedLines = [];
      copyButton(controls, "Copy loaded raw lines", () => loadedLines.join("\n"), { text: "Copy loaded" });
      const pre = wrap.createEl("pre", { cls: "atr-raw" });
      const more = wrap.createEl("button", { cls: "atr-load-more", attr: { type: "button" } });
      let cursor = 0;
      let rawLines;
      if (trace.raw !== void 0) rawLines = trace.raw.split(/\r?\n/);
      const updateMore = () => {
        const remaining = trace.lineCount - cursor;
        if (!remaining) {
          more.remove();
          return;
        }
        more.textContent = `Load next ${Math.min(RAW_PAGE_SIZE, remaining).toLocaleString()} lines \xB7 ${remaining.toLocaleString()} remaining`;
      };
      const renderNext = () => {
        const end = Math.min(cursor + RAW_PAGE_SIZE, trace.lineCount);
        for (; cursor < end; cursor += 1) {
          const line = trace.raw !== void 0 ? rawLines[cursor] || "" : readLineRef(trace.lineRefs[cursor]);
          loadedLines.push(line);
          const lineEl = pre.createDiv({ cls: "atr-raw-line" });
          lineEl.createSpan({ cls: "atr-line-number", text: String(cursor + 1) });
          lineEl.createSpan({ cls: "atr-line-content", text: line });
        }
        updateMore();
      };
      more.onclick = renderNext;
      renderNext();
    }
    function groups(sessions) {
      const grouped = /* @__PURE__ */ new Map();
      for (const session of sessions) {
        const label = day(session.modifiedMs);
        if (!grouped.has(label)) grouped.set(label, []);
        grouped.get(label).push(session);
      }
      return grouped;
    }
    function btn(parent, icon, label) {
      const button = parent.createEl("button", {
        cls: "clickable-icon atr-icon-button",
        attr: { type: "button", title: label, "aria-label": label }
      });
      setIcon(button, icon);
      return button;
    }
    function copyButton(parent, label, getText, options = {}) {
      const button = parent.createEl("button", {
        cls: `clickable-icon atr-copy-button${options.text ? " atr-copy-labeled" : ""}`,
        attr: { type: "button", title: label, "aria-label": label }
      });
      setIcon(button, "copy");
      if (options.text) button.createSpan({ text: options.text });
      button.onclick = async (event) => {
        event.preventDefault();
        event.stopPropagation();
        try {
          const value = await getText();
          if (value === void 0 || value === null || String(value).length === 0) {
            throw new Error("Nothing to copy");
          }
          await copyText(String(value));
          button.addClass("is-copied");
          const clearCopied = typeof window !== "undefined" ? window.setTimeout : setTimeout;
          clearCopied(() => button.removeClass("is-copied"), 1200);
          if (typeof Notice === "function") new Notice(`${label} copied`);
        } catch (error) {
          if (typeof Notice === "function") new Notice(`Could not copy: ${err(error)}`);
        }
      };
      return button;
    }
    async function copyText(value) {
      if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
        try {
          await navigator.clipboard.writeText(value);
          return;
        } catch {
        }
      }
      if (typeof document === "undefined" || !document.body) throw new Error("Clipboard unavailable");
      const textarea = document.createElement("textarea");
      textarea.value = value;
      textarea.setAttribute("readonly", "");
      textarea.style.position = "fixed";
      textarea.style.opacity = "0";
      document.body.appendChild(textarea);
      textarea.select();
      try {
        if (!document.execCommand("copy")) throw new Error("Clipboard unavailable");
      } finally {
        textarea.remove();
      }
    }
    function eventCopyText(event) {
      return eventCopyTextFromHydrated(hydrateEvent(event), event);
    }
    function eventCopyTextFromHydrated(hydrated, event) {
      if (hydrated?.content !== void 0) return hydrated.content;
      if (hydrated?.raw !== void 0) return JSON.stringify(hydrated.raw, null, 2);
      return hydrated?.title || event.title || "";
    }
    module2.exports = { Settings: Settings2, Sessions: Sessions2, Trace: Trace2, JsonView: JsonView2 };
  }
});

// src/main.js
var { Plugin } = require("obsidian");
var { VS, VT, VJ, EXT, DEF, codexHomeFromLegacy } = require_shared();
var { Settings, Sessions, Trace, JsonView } = require_views();
var AgentTraceReaderPlugin = class extends Plugin {
  async onload() {
    const saved = await this.loadData() || {};
    this.settings = { ...DEF, ...saved };
    if (!saved.codexHomePath && saved.codexSessionsPath) {
      this.settings.codexHomePath = codexHomeFromLegacy(saved.codexSessionsPath);
    }
    this.registerView(VS, (leaf) => new Sessions(leaf, this));
    this.registerView(VT, (leaf) => new Trace(leaf, this));
    this.registerView(VJ, (leaf) => new JsonView(leaf));
    this.registerExtensions(EXT, VJ);
    this.addRibbonIcon("messages-square", "Agent trace sessions", () => this.openSessions());
    this.addCommand({
      id: "open-agent-trace-sessions",
      name: "Open agent trace sessions",
      callback: () => this.openSessions()
    });
    this.addSettingTab(new Settings(this.app, this));
  }
  async save() {
    await this.saveData(this.settings);
  }
  async openSessions() {
    const leaf = this.app.workspace.getLeavesOfType(VS)[0] || this.app.workspace.getLeaf("tab");
    await leaf.setViewState({ type: VS, active: true });
    this.app.workspace.revealLeaf(leaf);
  }
  async openTrace(filePath) {
    const leaf = this.app.workspace.getLeaf("tab");
    await leaf.setViewState({ type: VT, active: true, state: { filePath } });
    this.app.workspace.revealLeaf(leaf);
  }
};
module.exports = AgentTraceReaderPlugin;
