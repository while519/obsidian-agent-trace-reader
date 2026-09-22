const {
  ItemView,
  TextFileView,
  PluginSettingTab,
  Setting,
  MarkdownRenderer,
  Notice,
  setIcon,
} = require("obsidian");
const fs = require("fs");
const shared = require("./shared");
const source = require("./sources/codex");
const {
  VS,
  VT,
  VJ,
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
  filterSessions,
} = shared;
const {
  parseTraceFile,
  conversationEvents,
  hydrateEvent,
  copyEventCollection,
  readLineRef,
  scan,
} = source;

class Settings extends PluginSettingTab {
  constructor(app, plugin) {
    super(app, plugin);
    this.p = plugin;
  }

  display() {
    const el = this.containerEl;
    el.empty();
    el.createEl("h2", { text: "Agent Trace Reader" });

    new Setting(el)
      .setName("Codex home")
      .setDesc("Reads sessions/ and archived_sessions/ under this folder. Read-only; nothing is copied into the vault.")
      .addText((text) =>
        text
          .setValue(this.p.settings.codexHomePath)
          .onChange(async (value) => {
            const next = value.trim();
            if (!next) return;
            this.p.settings.codexHomePath = home(next);
            await this.p.save();
          }),
      );

    new Setting(el)
      .setName("Maximum sessions")
      .setDesc("Limit the number of sessions shown after scanning the folder.")
      .addText((text) =>
        text.setValue(String(this.p.settings.maxSessions)).onChange(async (value) => {
          const next = parseInt(value, 10);
          if (next > 0) {
            this.p.settings.maxSessions = Math.min(next, 5000);
            await this.p.save();
          }
        }),
      );

    new Setting(el)
      .setName("Compact conversation")
      .setDesc("Collapse system/tool/reasoning traffic into Process blocks.")
      .addToggle((toggle) =>
        toggle.setValue(this.p.settings.compactConversation).onChange(async (value) => {
          this.p.settings.compactConversation = value;
          await this.p.save();
        }),
      );
  }
}

class Sessions extends ItemView {
  constructor(leaf, plugin) {
    super(leaf);
    this.p = plugin;
    this.sessions = null;
    this.query = "";
  }

  getViewType() {
    return VS;
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
    heading.createDiv({ cls: "atr-muted", text: "Codex · local, read-only" });
    const tools = header.createDiv({ cls: "atr-session-tools" });
    const search = tools.createEl("input", {
      cls: "atr-session-search",
      attr: {
        type: "search",
        placeholder: "Search title, cwd, id, or path",
        "aria-label": "Search sessions",
      },
    });
    search.value = this.query;
    const refresh = btn(tools, "refresh-cw", "Refresh");
    refresh.onclick = () => this.render(true);

    const root = home(this.p.settings.codexHomePath || DEFAULT_CODEX_HOME);
    const source = rootEl.createDiv({ cls: "atr-source" });
    source.createSpan({ text: root });
    copyButton(source, "Copy Codex home", () => root, { text: "Copy path" });
    if (!dir(root)) {
      this.sessions = null;
      rootEl.createDiv({
        cls: "atr-empty-card",
        text: "Codex home not found. Set it in Settings → Agent Trace Reader.",
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
      parent.createDiv({ cls: "atr-empty-card", text: `No sessions match “${this.query.trim()}”.` });
      return;
    }

    const titleCounts = new Map();
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
        text: `${items.length.toLocaleString()} session${items.length === 1 ? "" : "s"}`,
      });
      for (const session of items) {
        const row = section.createDiv({ cls: "atr-session-row" });
        const cardEl = row.createEl("button", {
          cls: "atr-session-card",
          attr: { type: "button" },
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
}

class Trace extends ItemView {
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
    return VT;
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
    this.contentEl.createDiv({ cls: "atr-loading", text: "Loading trace…" });

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
    if (trace.isLarge) meta.createSpan({ text: `${formatBytes(trace.fileSize)} · streamed` });
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
        text: cap(tab),
      });
      tabEl.onclick = () => {
        this.tab = tab;
        this.render();
      };
    }

    if (trace.errors.length) {
      rootEl.createDiv({
        cls: "atr-warning",
        text: `${trace.errors.length} malformed JSONL line(s); Raw remains available.`,
      });
    }
    if (this.changed) {
      rootEl.createDiv({ cls: "atr-trace-changed", text: "Trace changed on disk. Refresh to read the new records." });
    }
    if (trace.isLarge) {
      rootEl.createDiv({
        cls: "atr-note",
        text: "Large trace: records and raw evidence load in pages; expanding an event reads only that line.",
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
        text: "No conversation events recognized. Use Trajectory or Raw.",
      });
      return;
    }

    let process = [];
    const flush = () => {
      if (!process.length) return;
      processBlock(parent, process, this, this.p.settings.compactConversation);
      process = [];
    };

    for (const event of use) {
      if (event.kind === "user" || event.kind === "assistant") {
        flush();
        card(parent, event, this);
      } else {
        process.push(event);
      }
    }
    flush();
  }

  traj(parent, events) {
    const list = parent.createDiv({ cls: "atr-event-list" });
    let cursor = 0;
    const more = parent.createEl("button", {
      cls: "atr-load-more",
      attr: { type: "button" },
    });

    const updateMore = () => {
      const remaining = events.length - cursor;
      if (!remaining) {
        more.remove();
        return;
      }
      more.textContent = `Load next ${Math.min(PROCESS_PAGE_SIZE, remaining).toLocaleString()} events · ${remaining.toLocaleString()} remaining`;
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
      text: "Trace changed on disk. Refresh to read the new records.",
    });
    if (body) body.before(notice);
  }
}

class JsonView extends TextFileView {
  getViewType() {
    return VJ;
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
          text: `${(lines.length - JLIM).toLocaleString()} records hidden for performance.`,
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
}

function processBlock(parent, events, comp, compact) {
  const details = parent.createEl("details", { cls: "atr-process" });
  if (!compact) details.open = true;
  const summary = details.createEl("summary");
  summary.createSpan({
    cls: "atr-process-label",
    text: `Process · ${events.length.toLocaleString()} event${events.length === 1 ? "" : "s"}`,
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
          attr: { type: "button" },
        });
        more.onclick = renderNext;
      }
      const remaining = events.length - cursor;
      more.textContent = `Load next ${Math.min(PROCESS_PAGE_SIZE, remaining).toLocaleString()} process events · ${remaining.toLocaleString()} remaining`;
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

  if (event.content !== undefined) {
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
  summary.createSpan({ text: `${formatChars(event.contentLength)} · Expand to load` });
  if (event.preview) summary.createSpan({ cls: "atr-lazy-preview", text: ` · ${event.preview}` });
  const body = details.createDiv({ cls: "atr-message-body" });
  let loaded = false;

  details.addEventListener("toggle", () => {
    if (!details.open || loaded) return;
    loaded = true;
    try {
      const hydrated = hydrateEvent(event);
      if (hydrated && hydrated.content !== undefined) {
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
  summary.createSpan({ cls: "atr-event-time", text: event.timestamp ? time(event.timestamp) : "—" });
  summary.createSpan({ cls: "atr-event-kind", text: event.kind });
  const title = event.hasContent && event.content === undefined
    ? `${event.title} · ${formatChars(event.contentLength)}`
    : event.title;
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
    if (hydrated.content !== undefined) smart(parent, hydrated.content, comp);
    if (hydrated.raw !== undefined) jsonTree(parent, hydrated.raw, "raw", comp);
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
  const modes = [...(markdown ? ["Rendered"] : []), "Text", "Raw", ...(parsed !== null ? ["JSON"] : [])];
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
      text: typeof value === "string" ? value : JSON.stringify(value),
    });
    const copy = copyButton(row, "Copy value", () => jsonValueText(value));
    copy.addClass("atr-json-copy");
  }
}

function rawView(parent, trace) {
  const wrap = parent.createDiv({ cls: "atr-raw-view" });
  const info = wrap.createDiv({
    cls: "atr-raw-info",
    text: `${trace.lineCount.toLocaleString()} lines · paged read-only evidence`,
  });
  if (trace.filePath) info.setAttribute("title", trace.filePath);
  const controls = wrap.createDiv({ cls: "atr-raw-controls" });
  const loadedLines = [];
  copyButton(controls, "Copy loaded raw lines", () => loadedLines.join("\n"), { text: "Copy loaded" });
  const pre = wrap.createEl("pre", { cls: "atr-raw" });
  const more = wrap.createEl("button", { cls: "atr-load-more", attr: { type: "button" } });
  let cursor = 0;
  let rawLines;
  if (trace.raw !== undefined) rawLines = trace.raw.split(/\r?\n/);

  const updateMore = () => {
    const remaining = trace.lineCount - cursor;
    if (!remaining) {
      more.remove();
      return;
    }
    more.textContent = `Load next ${Math.min(RAW_PAGE_SIZE, remaining).toLocaleString()} lines · ${remaining.toLocaleString()} remaining`;
  };

  const renderNext = () => {
    const end = Math.min(cursor + RAW_PAGE_SIZE, trace.lineCount);
    for (; cursor < end; cursor += 1) {
      const line = trace.raw !== undefined ? rawLines[cursor] || "" : readLineRef(trace.lineRefs[cursor]);
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
  const grouped = new Map();
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
    attr: { type: "button", title: label, "aria-label": label },
  });
  setIcon(button, icon);
  return button;
}

function copyButton(parent, label, getText, options = {}) {
  const button = parent.createEl("button", {
    cls: `clickable-icon atr-copy-button${options.text ? " atr-copy-labeled" : ""}`,
    attr: { type: "button", title: label, "aria-label": label },
  });
  setIcon(button, "copy");
  if (options.text) button.createSpan({ text: options.text });
  button.onclick = async (event) => {
    event.preventDefault();
    event.stopPropagation();
    try {
      const value = await getText();
      if (value === undefined || value === null || String(value).length === 0) {
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
      // Fall through to the focused-document fallback used by older Electron builds.
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
  if (hydrated?.content !== undefined) return hydrated.content;
  if (hydrated?.raw !== undefined) return JSON.stringify(hydrated.raw, null, 2);
  return hydrated?.title || event.title || "";
}

function jsonValueText(value) {
  return typeof value === "string" ? value : JSON.stringify(value);
}

module.exports = { Settings, Sessions, Trace, JsonView };
