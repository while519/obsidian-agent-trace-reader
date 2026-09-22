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
          { sourceSubtype: type }
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
          { sourceSubtype: type }
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
      const archived = found.filter((session) => session.archived);
      const active = found.filter((session) => !session.archived);
      const selected = [
        ...archived.slice(0, limit),
        ...active.slice(0, Math.max(0, limit - archived.length))
      ].sort((a, b) => b.modifiedMs - a.modifiedMs);
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

// src/views.js
var require_views = __commonJS({
  "src/views.js"(exports2, module2) {
    var {
      ItemView,
      TextFileView,
      PluginSettingTab,
      Setting,
      MarkdownRenderer,
      Notice,
      setIcon
    } = require("obsidian");
    var fs = require("fs");
    var shared = require_shared();
    var source = require_codex();
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
        for (const tab of ["conversation", "trajectory", "raw"]) {
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
    var JsonView2 = class extends TextFileView {
      getViewType() {
        return VJ2;
      }
      getDisplayText() {
        return this.file?.basename || "JSON viewer";
      }
      getIcon() {
        return "braces";
      }
      setViewData(data) {
        this.data = data;
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
        const rootEl = this.contentEl;
        rootEl.empty();
        rootEl.addClass("atr-json");
        const header = rootEl.createDiv({ cls: "atr-header" });
        header.createEl("h2", { text: this.file?.name || "JSON" });
        copyButton(header, "Copy JSON", () => this.data, { text: "Copy" });
        const extension = this.file?.extension?.toLowerCase() || "json";
        if (extension === "jsonl" || extension === "ndjson") {
          const lines = this.data.split(/\r?\n/).filter((line) => line.trim());
          lines.slice(0, JLIM).forEach((line, index) => {
            const record = rootEl.createEl("details", { cls: "atr-json-record" });
            const summary = record.createEl("summary");
            summary.createSpan({ text: `line ${index + 1}` });
            copyButton(summary, "Copy record", () => line);
            try {
              jsonTree(record, JSON.parse(line), "root", this);
            } catch {
              record.createEl("pre", { text: line });
            }
          });
          if (lines.length > JLIM) {
            rootEl.createDiv({
              cls: "atr-warning",
              text: `${(lines.length - JLIM).toLocaleString()} records hidden for performance.`
            });
          }
          return;
        }
        try {
          jsonTree(rootEl, JSON.parse(this.data), "root", this);
        } catch (error) {
          rootEl.createDiv({ cls: "atr-error", text: `JSON parse error: ${err(error)}` });
          rootEl.createEl("pre", { text: this.data });
        }
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
        if (hydrated.raw !== void 0) jsonTree(parent, hydrated.raw, "raw", comp);
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
          jsonTree(output, parsed, "root", comp);
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
    function jsonTree(parent, value, label, comp) {
      if (Array.isArray(value)) {
        const branch = parent.createEl("details", { cls: "atr-json-branch", attr: { open: "" } });
        const summary = branch.createEl("summary");
        summary.createSpan({ text: `${label}  [${value.length}]` });
        copyButton(summary, "Copy JSON", () => JSON.stringify(value, null, 2));
        value.forEach((item, index) => jsonTree(branch, item, `[${index}]`, comp));
        return;
      }
      if (obj(value)) {
        const entries = Object.entries(value);
        const branch = parent.createEl("details", { cls: "atr-json-branch", attr: { open: "" } });
        const summary = branch.createEl("summary");
        summary.createSpan({ text: `${label}  {${entries.length}}` });
        copyButton(summary, "Copy JSON", () => JSON.stringify(value, null, 2));
        entries.forEach(([key, item]) => jsonTree(branch, item, key, comp));
        return;
      }
      const row = parent.createDiv({ cls: "atr-json-leaf" });
      row.createSpan({ cls: "atr-json-key", text: label });
      row.createSpan({ cls: "atr-json-type", text: value === null ? "null" : typeof value });
      if (typeof value === "string" && (value.length >= SMART || /\r?\n/.test(value))) {
        const smartEl = row.createDiv({ cls: "atr-json-smart" });
        smart(smartEl, value, comp);
      } else {
        row.createSpan({
          cls: "atr-json-value",
          text: typeof value === "string" ? value : JSON.stringify(value)
        });
        const copy = copyButton(row, "Copy value", () => jsonValueText(value));
        copy.addClass("atr-json-copy");
      }
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
    function jsonValueText(value) {
      return typeof value === "string" ? value : JSON.stringify(value);
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
