const fs = require("fs");
const path = require("path");
const {
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
  hashText,
} = require("../shared");

async function parseTraceFile(filePath) {
  const stat = fs.statSync(filePath);
  const large = stat.size > TRACE_LARGE_BYTES;
  const events = [];
  const errors = [];
  const lineRefs = [];
  const meta = {
    sessionId: undefined,
    cwd: undefined,
    createdAt: undefined,
    sessionTitle: undefined,
    firstUser: undefined,
    preferredUser: undefined,
    reviewTitle: undefined,
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
    isLarge: large,
  });
}

function parseTrace(raw) {
  const events = [];
  const errors = [];
  const meta = {
    sessionId: undefined,
    cwd: undefined,
    createdAt: undefined,
    sessionTitle: undefined,
    firstUser: undefined,
    preferredUser: undefined,
    reviewTitle: undefined,
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
    isLarge: false,
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
    ...rest,
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
  const candidate = event.content !== undefined ? event.content : event.preview;
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
    return makeEvent(index, undefined, "unknown", "unknown", "Unknown", undefined, record, { keepRaw, keepContent });
  }

  const timestamp = str(record.timestamp);
  const sourceType = str(record.type) || "unknown";
  const payload = obj(record.payload) ? record.payload : null;

  if (sourceType === "session_meta") {
    return makeEvent(index, timestamp, sourceType, "metadata", "Session metadata", undefined, record, { keepRaw, keepContent });
  }
  if (sourceType === "turn_context") {
    return makeEvent(index, timestamp, sourceType, "metadata", "Turn context", undefined, record, { keepRaw, keepContent });
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
    const kind = normalizedRole === "user"
      ? "user"
      : normalizedRole === "assistant"
        ? "assistant"
        : normalizedRole === "system" || normalizedRole === "developer"
          ? "system"
          : "event";
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
      { sourceSubtype: type },
    );
  }
  if (/function_call|tool_call|custom_tool_call/i.test(type)) {
    const args = payload.arguments ?? payload.input ?? payload.params;
    const content = typeof args === "string" ? args : args !== undefined ? JSON.stringify(args, null, 2) : text;
    return makeEvent(
      index,
      timestamp,
      "response_item",
      "tool-call",
      str(payload.name) || str(payload.tool_name) || "Tool call",
      content,
      record,
      options,
      { sourceSubtype: type },
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
    preview: hasContent ? previewOf(content) : undefined,
    ...extra,
  };
  if (hasContent && (kind === "user" || kind === "assistant")) event.contentHash = hashText(content);
  if (options.keepContent && hasContent) event.content = content;
  if (options.keepRaw) event.raw = record;
  return event;
}

function extract(value) {
  if (typeof value === "string") return value;
  if (Array.isArray(value)) {
    const parts = value.map(extract).filter((item) => item !== undefined);
    return parts.length ? parts.join("\n\n") : undefined;
  }
  if (!obj(value)) return undefined;
  for (const key of ["text", "message", "content", "output_text", "input_text", "output", "summary"]) {
    const result = extract(value[key]);
    if (result !== undefined && result !== "") return result;
  }
  return undefined;
}

function conversationEvents(events) {
  const out = [];
  const seenReasoning = new Set();
  const hasResponseReasoning = events.some(
    (event) => event.kind === "reasoning" && event.sourceType === "response_item",
  );
  const hasReadableResponseReasoning = events.some(
    (event) => event.kind === "reasoning" && event.sourceType === "response_item" && event.hasContent,
  );
  const hasReadableEventReasoning = events.some(
    (event) => event.kind === "reasoning" && event.sourceType === "event_msg" && event.hasContent,
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
  if (content === undefined && isBootstrap(event.preview) && event.ref) {
    try {
      content = hydrateEvent(event)?.content;
    } catch {
      // Keep the bootstrap event out of the readable projection if its full line cannot be read.
    }
  }

  const candidate = content !== undefined ? content : event.preview;
  if (!isBootstrap(candidate)) return event;
  const extracted = transcriptTitle(content || candidate);
  if (!extracted) return undefined;
  return {
    ...event,
    title: "User",
    content: extracted,
    contentLength: extracted.length,
    preview: previewOf(extracted),
    contentHash: hashText(extracted),
  };
}

function hydrateEvent(event) {
  if (event.raw !== undefined) return event;
  if (!event.ref) return event;
  const line = readLineRef(event.ref);
  const record = JSON.parse(line);
  const hydrated = norm(record, event.index, { keepRaw: true, keepContent: true });
  hydrated.lineNumber = event.lineNumber;
  hydrated.ref = event.ref;
  return hydrated;
}

async function hydrateEvents(events) {
  const handles = new Map();
  const hydrated = [];
  try {
    for (const event of events) {
      if (event.raw !== undefined || !event.ref) {
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
  return hydrated
    .map((event, index) => {
      if (event.content !== undefined) return event.content;
      if (event.raw !== undefined) return JSON.stringify(event.raw, null, 2);
      return event.title || events[index].title || "";
    })
    .filter((value) => value !== undefined && value !== "")
    .join("\n\n");
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
          text: data.toString("utf8", start, contentEnd),
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
        text: carry.toString("utf8", 0, contentEnd),
      };
    }
  } finally {
    stream.destroy();
  }
}

function readLineRef(ref) {
  if (!ref || ref.offset === null || ref.length === undefined) return "";
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
  if (!ref || ref.offset === null || ref.length === undefined) return "";
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
    ...active.slice(0, Math.max(0, limit - archived.length)),
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
    // The session may be rotating while the list is refreshed.
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
    // Metadata is optional; the session remains openable from its path.
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
        if ((previous.kind === "assistant" && event.kind === "user") || (previous.kind === "user" && event.kind === "assistant")) break;
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
  if (a.content !== undefined && b.content !== undefined) return a.content === b.content;
  return a.contentLength === b.contentLength && Boolean(a.contentHash) && a.contentHash === b.contentHash;
}

module.exports = {
  parseTraceFile,
  parseTrace,
  norm,
  conversationEvents,
  hydrateEvent,
  hydrateEvents,
  copyEventCollection,
  jsonlLines,
  readLineRef,
  scan,
};
