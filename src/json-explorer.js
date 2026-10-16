"use strict";

const { TextFileView, MarkdownRenderer, Notice, setIcon } = require("obsidian");
const { PAGE_SIZE, appendPointer, resolvePointer, kindOf, preview, searchValue, parseJsonlPage, jsonErrorLocation } = require("./structured-data");

const CHILD_PAGE = 80;
const RAW_PREVIEW = 250000;

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
        node.value = String(text); node.style.position = "fixed"; node.style.opacity = "0";
        document.body.appendChild(node); node.select();
        if (!document.execCommand("copy")) throw new Error("Clipboard unavailable");
        node.remove();
      }
      new Notice("Copied " + label.toLowerCase());
    } catch (error) { new Notice("Copy failed: " + error.message); }
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
  box.createEl("summary", { text: "String · " + value.length.toLocaleString() + " characters · " + preview(value, 110) });
  const controls = box.createDiv({ cls: "atr-data-long-controls" });
  const content = box.createDiv({ cls: "atr-data-long-body" });
  const json = value.trim().startsWith("{") || value.trim().startsWith("[") ? tryJSON(value) : null;
  const tabs = ["Text", ...(value.length <= 250000 ? ["Markdown"] : []), ...(json !== null ? ["JSON"] : [])];
  let active = "Text", loaded = false;
  function render() {
    loaded = true; content.empty();
    controls.querySelectorAll("button.atr-data-button").forEach(node => node.toggleClass("is-active", node.textContent === active));
    if (active === "Markdown" && view?.app) {
      const result = MarkdownRenderer.render(view.app, value, content, view.file?.path || "", view);
      if (result?.catch) result.catch(() => { content.empty(); content.createEl("pre", { text: value }); });
    } else if (active === "JSON" && json !== null) {
      renderJsonTree(content, json, "value", view);
    } else content.createEl("pre", { cls: "atr-data-text", text: value });
  }
  for (const tab of tabs) elementButton(controls, tab, () => { active = tab; render(); }, tab === active ? "is-active" : "");
  copyButton(controls, "Copy string", () => value);
  box.addEventListener("toggle", () => { if (box.open && !loaded) render(); });
}
function tryJSON(value) { try { return JSON.parse(value); } catch { return null; } }

/**
 * Original tree renderer for structured trace payloads and ordinary JSON documents.
 * Children are created only when opened, and individual collections are paginated.
 * Pointer navigation uses RFC 6901 escaping; no raw HTML is injected.
 */
function renderJsonTree(parent, rootValue, label = "root", view = null, focusPath = "") {
  if (typeof label === "object" && label !== null) { focusPath = label.focusPath || ""; view = label.view || null; label = label.label || "root"; }
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
        leaf.createSpan({ cls: "atr-data-value", text: preview(value, 2000) });
      }
      const actions = leaf.createSpan({ cls: "atr-data-actions" });
      copyButton(actions, "Copy path", () => pointer || "/");
      copyButton(actions, "Copy value", () => type === "string" ? value : JSON.stringify(value));
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
        if (!more) more = elementButton(children, "", () => { more.remove(); showNext(); }, "atr-data-more");
        more.textContent = "Load next " + Math.min(CHILD_PAGE, keys.length - cursor) + " · " + (keys.length - cursor) + " remaining";
      }
    };
    details.addEventListener("toggle", () => { if (details.open && cursor === 0) showNext(); });
    const isOnFocusPath = Boolean(focusPath && (pointer === "" || focusPath === pointer || focusPath.startsWith(pointer + "/")));
    if ((pointer === "" && label !== "record") || isOnFocusPath) {
      details.open = true;
      const remainingPath = pointer ? focusPath.slice(pointer.length + 1) : focusPath.slice(1);
      const segment = remainingPath.split("/")[0].replace(/~1/g, "/").replace(/~0/g, "~");
      const targetIndex = isOnFocusPath && segment ? keys.indexOf(segment) : -1;
      if (targetIndex >= CHILD_PAGE) {
        cursor = keys.length;
        children.createDiv({ cls: "atr-data-focus-note", text: "Focused match at item " + (targetIndex + 1) + " / " + keys.length });
        renderNode(children, collection[segment], segment, appendPointer(pointer, segment), depth + 1);
        elementButton(children, "Browse this collection from the start", () => { children.empty(); cursor = 0; showNext(); });
      } else showNext();
    }
  };
  renderNode(nodeRoot, rootValue, label, "", 0);
  return nodeRoot;
}

class JsonView extends TextFileView {
  constructor(leaf) { super(leaf); this.data = ""; this.page = 0; this.mode = "tree"; this.query = ""; }
  getViewType() { return "agent-trace-json"; }
  getDisplayText() { return this.file?.basename || "JSON"; }
  getIcon() { return "braces"; }
  setViewData(data) { this.data = data; this.page = 0; this.render(); }
  getViewData() { return this.data; }
  clear() { this.data = ""; this.contentEl.empty(); }

  render() {
    const root = this.contentEl;
    root.empty();
    root.addClass("atr-json");
    const header = root.createDiv({ cls: "atr-data-header" });
    const name = header.createDiv();
    name.createEl("h2", { text: this.file?.name || "Structured Data" });
    name.createDiv({ cls: "atr-data-subtitle", text: "Structured document · read-only" });
    copyButton(header, "Copy document", () => this.data);

    const controls = root.createDiv({ cls: "atr-data-toolbar" });
    elementButton(controls, "Tree", () => { this.mode = "tree"; this.render(); }, this.mode === "tree" ? "is-active" : "");
    elementButton(controls, "Raw", () => { this.mode = "raw"; this.render(); }, this.mode === "raw" ? "is-active" : "");
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
    try { parsed = JSON.parse(this.data); }
    catch (error) {
      const position = jsonErrorLocation(error.message, this.data);
      const suffix = position ? " (line " + position.line + ", column " + position.column + ")" : "";
      body.createDiv({ cls: "atr-data-error", text: "Invalid JSON: " + error.message + suffix });
      body.createEl("pre", { cls: "atr-data-text", text: this.data.slice(0, 8000) });
      return;
    }
    const search = controls.createEl("input", { cls: "atr-data-search", attr: { type: "search", placeholder: "Search keys, values, JSON Pointer…", "aria-label": "Search JSON" } });
    search.value = this.query;
    const results = body.createDiv({ cls: "atr-data-search-results" });
    const tree = body.createDiv();
    const select = (pointer) => { tree.empty(); renderJsonTree(tree, parsed, "root", this, pointer); };
    select("");
    const searchNow = () => {
      results.empty();
      this.query = search.value;
      if (!this.query.trim()) return;
      const found = searchValue(parsed, this.query);
      results.createDiv({ cls: "atr-data-result-count", text: found.matches.length + " matches" + (found.truncated ? " · limited results" : "") });
      for (const hit of found.matches) {
        const button = elementButton(results, (hit.path || "/") + " · " + hit.preview, () => select(hit.path), "atr-data-search-hit");
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
    elementButton(nav, "← Previous", () => { this.page = Math.max(0, this.page - 1); this.render(); }, this.page === 0 ? "is-disabled" : "");
    nav.createSpan({ text: "Page " + (this.page + 1) + " / " + totalPages });
    elementButton(nav, "Next →", () => { this.page = Math.min(totalPages - 1, this.page + 1); this.render(); }, this.page === totalPages - 1 ? "is-disabled" : "");
    const page = parseJsonlPage(lines, this.page, PAGE_SIZE);
    for (const record of page.records) {
      const section = body.createDiv({ cls: "atr-data-record" });
      section.createDiv({ cls: "atr-data-record-label", text: "Line " + record.line });
      if (record.error) {
        section.createDiv({ cls: "atr-data-error", text: record.error });
        section.createEl("pre", { cls: "atr-data-text", text: record.source.slice(0, 4000) });
      } else renderJsonTree(section, record.value, "record", this);
    }
    body.createDiv({ cls: "atr-data-subtitle", text: lines.length.toLocaleString() + " source lines · parsed one page at a time" });
  }
}
module.exports = { JsonView, renderJsonTree };