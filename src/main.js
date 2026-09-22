const { Plugin } = require("obsidian");
const { VS, VT, VJ, EXT, DEF, codexHomeFromLegacy } = require("./shared");
const { Settings, Sessions, Trace, JsonView } = require("./views");

class AgentTraceReaderPlugin extends Plugin {
  async onload() {
    const saved = (await this.loadData()) || {};
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

module.exports = AgentTraceReaderPlugin;
