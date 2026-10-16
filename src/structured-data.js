"use strict";

// Independent structured-data primitives for the trace reader.
// No Obsidian dependency: the same functions run in unit tests.
const PAGE_SIZE = 80;
const SEARCH_LIMIT = 150;
const SEARCH_BUDGET = 50000;

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
  if (pointer[0] !== "/") return undefined;
  let value = root;
  for (const fragment of pointer.slice(1).split("/")) {
    const key = decodeSegment(fragment);
    if (value === null || typeof value !== "object" || !Object.prototype.hasOwnProperty.call(value, key)) return undefined;
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
    if ([node.key, node.path, text].some(part => String(part).toLocaleLowerCase().includes(needle))) {
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
    try { records.push({ line: i + 1, value: JSON.parse(line) }); }
    catch (error) { records.push({ line: i + 1, error: error.message, source: line }); }
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
module.exports = { PAGE_SIZE, appendPointer, resolvePointer, kindOf, preview, searchValue, parseJsonlPage, jsonErrorLocation };