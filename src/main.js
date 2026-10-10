const { Plugin } = require("obsidian");
const { VS, VT, VJ, EXT, DEF, codexHomeFromLegacy } = require("./shared");
const { Settings, Sessions, Trace, JsonView } = require("./views");

class AgentTraceReaderPlugin extends Plugin {
  async onload() {
    const saved = (await this.loadData()) || {};
    this.settings = { ...DEF, ...saved };
    this.settings.bookmarks = normalizeBookmarks(saved.bookmarks);
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
      callback: () => this.openSessions(),
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
}

function normalizeBookmarks(value) {
  if (!Array.isArray(value)) return [];
  const bookmarks = [];
  for (const item of value) {
    if (!item || typeof item !== "object") continue;
    const bookmark = {
      sessionId: typeof item.sessionId === "string" ? item.sessionId : undefined,
      filePath: typeof item.filePath === "string" ? item.filePath : undefined,
      fileName: typeof item.fileName === "string" ? item.fileName : undefined,
      title: typeof item.title === "string" ? item.title : undefined,
      cwd: typeof item.cwd === "string" ? item.cwd : undefined,
      archived: item.archived === true,
      modifiedMs: Number.isFinite(item.modifiedMs) ? item.modifiedMs : undefined,
      bookmarkedAt: Number.isFinite(item.bookmarkedAt) ? item.bookmarkedAt : Date.now(),
    };
    if (!bookmark.sessionId && !bookmark.filePath && !bookmark.fileName) continue;
    const duplicate = bookmarks.some((saved) => {
      if (bookmark.sessionId && saved.sessionId) return saved.sessionId === bookmark.sessionId;
      return Boolean((bookmark.fileName && saved.fileName === bookmark.fileName)
        || (bookmark.filePath && saved.filePath === bookmark.filePath));
    });
    if (!duplicate) bookmarks.push(bookmark);
  }
  return bookmarks;
}

module.exports = AgentTraceReaderPlugin;
