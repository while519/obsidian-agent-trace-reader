"use strict";
const { MarkdownRenderer, setIcon } = require("obsidian");
const { hydrateEvent } = require("./sources/codex");
const { renderJsonTree } = require("./json-explorer");
const { projectTurns, pairCalls, timelineBounds, eventTimeline, durationText, eventLabel, searchEvents } = require("./trace-model");

const BATCH = 120;

function renderTraceExplorer(parent, trace, view) {
  const events = trace.events || [];
  const pairs = pairCalls(events);
  const bounds = timelineBounds(events);
  const groups = projectTurns(events);
  const wrap = parent.createDiv({ cls: "atr-explorer" });
  const summary = wrap.createDiv({ cls: "atr-explorer-summary" });
  summary.createSpan({ text: events.length.toLocaleString() + " events" });
  summary.createSpan({ text: groups.filter(group => group.number).length + " turns" });
  summary.createSpan({ text: events.filter(event => event.kind === "tool-call").length + " tools" });
  summary.createSpan({ text: Math.floor(pairs.size / 2) + " paired calls" });
  if (trace.errors.length) summary.createSpan({ cls: "atr-explorer-warning", text: trace.errors.length + " malformed lines" });

  const toolbar = wrap.createDiv({ cls: "atr-explorer-toolbar" });
  const search = toolbar.createEl("input", { cls: "atr-explorer-search", attr: { type: "search", placeholder: "Filter event type, tool name, text…", "aria-label": "Search events" } });
  const select = toolbar.createEl("select", { cls: "atr-explorer-filter", attr: { "aria-label": "Filter event type" } });
  for (const kind of ["all", "user", "assistant", "tool-call", "tool-result", "reasoning", "event", "metadata", "unknown"]) {
    const option = select.createEl("option", { text: kind === "all" ? "All events" : kind });
    option.value = kind;
  }

  const layout = wrap.createDiv({ cls: "atr-explorer-layout" });
  const treePanel = layout.createDiv({ cls: "atr-explorer-tree" });
  const inspector = layout.createDiv({ cls: "atr-explorer-inspector" });
  let current = events.find(event => event.kind === "user" && !event.bootstrap) || events[0] || null;

  function inspect(event) {
    current = event;
    inspector.empty();
    if (!event) { inspector.createDiv({ cls: "atr-explorer-empty", text: "Select an event to inspect the original evidence." }); return; }
    const head = inspector.createDiv({ cls: "atr-explorer-inspector-head" });
    head.createEl("h3", { text: eventLabel(event) });
    const meta = head.createDiv({ cls: "atr-explorer-inspector-meta" });
    meta.createSpan({ text: event.kind });
    meta.createSpan({ text: "line " + (event.lineNumber || "—") });
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
      tabs.querySelectorAll("button").forEach(button => button.toggleClass("is-active", button.textContent === mode));
      let hydrated;
      try { hydrated = hydrateEvent(event); }
      catch (error) { body.createDiv({ cls: "atr-data-error", text: "Trace data unavailable: " + error.message }); return; }
      if (mode === "Content") {
        if (hydrated.content === undefined) body.createDiv({ cls: "atr-explorer-empty", text: "No text content. See Fields for the full event." });
        else body.createEl("pre", { cls: "atr-explorer-text", text: hydrated.content });
      } else if (mode === "Fields") {
        renderJsonTree(body, hydrated.raw === undefined ? hydrated : hydrated.raw, "event", view);
      } else if (mode === "Raw") {
        body.createEl("pre", { cls: "atr-explorer-text", text: JSON.stringify(hydrated.raw === undefined ? hydrated : hydrated.raw, null, 2) });
      } else if (mode === "Markdown" && hydrated.content) {
        const result = MarkdownRenderer.render(view.app, hydrated.content, body, "", view);
        if (result?.catch) result.catch(error => body.createDiv({ cls: "atr-data-error", text: error.message }));
      }
    };
    for (const tab of ["Content", "Fields", "Raw", "Markdown"]) {
      const button = tabs.createEl("button", { cls: "atr-explorer-tab", text: tab, attr: { type: "button" } });
      button.onclick = () => renderTab(tab);
    }
    renderTab("Content");
  }

  function drawList() {
    treePanel.empty();
    const q = search.value, kind = select.value;
    let visible = 0;
    for (const group of groups) {
      const matching = searchEvents(group.events, q, kind);
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
          const time = row.createDiv({ cls: "atr-explorer-row-time" });
          time.createSpan({ text: event.timestamp ? event.timestamp.slice(11, 23) : "no timestamp" });
          if (event.hasContent && event.preview) time.createSpan({ cls: "atr-explorer-preview", text: event.preview.slice(0, 110) });
          const visual = eventTimeline(event, pair, bounds);
          if (visual) {
            const track = row.createDiv({ cls: "atr-explorer-track" });
            const bar = track.createDiv({ cls: "atr-explorer-bar" + (visual.durationMs !== null ? " has-span" : "") });
            bar.style.left = visual.left + "%";
            bar.style.width = Math.max(.8, visual.width) + "%";
            bar.title = visual.durationMs !== null ? "Observed tool interval: " + durationText(visual.durationMs) : "Event timestamp";
          }
          row.onclick = () => {
            treePanel.querySelectorAll(".atr-explorer-row.is-active").forEach(node => node.removeClass("is-active"));
            row.addClass("is-active");
            inspect(event);
          };
        }
        const old = list.querySelector(".atr-explorer-more"); if (old) old.remove();
        if (cursor < matching.length) {
          const more = list.createEl("button", { cls: "atr-explorer-more", text: "Load " + Math.min(BATCH, matching.length - cursor) + " more events", attr: { type: "button" } });
          more.onclick = loadNext;
        }
      };
      loadNext();
    }
    if (!visible) treePanel.createDiv({ cls: "atr-explorer-empty", text: "No matching trace events." });
  }
  search.oninput = drawList;
  select.onchange = drawList;
  inspect(current);
  drawList();
}
module.exports = { renderTraceExplorer };