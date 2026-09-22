# Agent Trace Reader for Obsidian

A local-first, read-only reader for agent traces. v0.2 focuses on **Codex rollout sessions** and keeps a generic Smart JSON/JSONL viewer as the raw fallback.

## Highlights

- Auto-discovers Codex rollouts under `~/.codex/sessions` (configurable).
- Session browser grouped by recency; no symlink or copying into the vault.
- Session overview uses separated, color-coded recency sections and readable cards.
- Filters Codex runtime/bootstrap wrappers from titles; repeated titles get a short session-id suffix in the overview.
- Three views over the same evidence: **Conversation / Trajectory / Raw**.
- Compact Conversation mode groups system/tool/reasoning traffic into collapsible Process blocks.
- Expanded Process blocks keep their summary reachable while scrolling, so long blocks can be collapsed without returning to the top.
- Long strings get **Rendered / Text / Raw / JSON** modes.
- Copy actions are available for session paths, messages, Process blocks, events, JSON values, and loaded Raw pages.
- Unknown record types are never dropped; inspect them in Trajectory or Raw.
- Generic `.json`, `.jsonl`, and `.ndjson` files in the vault still get a smart reader.

## Install

For this development PR, test by copying `main.js`, `manifest.json`, and `styles.css` from the `dev/agent-trace-reader-v0.2` branch into `<Vault>/.obsidian/plugins/agent-trace-reader/`, then reload Obsidian and enable **Agent Trace Reader**.

After the first tagged release, BRAT becomes the one-step install/update path: add `while519/obsidian-agent-trace-reader` in BRAT.

Click the messages icon in Obsidian's left ribbon to open sessions.

The default Codex source is:

```text
~/.codex/sessions
```

Change it under **Settings → Agent Trace Reader** if needed.

## Design

```text
Codex JSONL
   ↓ source adapter
Normalized events
   ├─ Conversation
   ├─ Trajectory
   └─ Raw
```

The normalization layer is presentation-only. Original records remain available, and malformed/unknown lines do not invalidate the rest of a session.

## Safety / performance

- Read-only access to trace files.
- Session list reads only a small prefix for metadata/title.
- Opening a trace streams JSONL instead of reading the whole file into one JavaScript string.
- Large traces keep line offsets and normalized metadata in memory; event bodies and raw lines load on demand.
- Trajectory and Raw use paged rendering, and compact Conversation keeps Process bodies collapsed until opened.
- Copying an event or Process hydrates only when the action is invoked; Raw offers a bounded **Copy loaded** action.
- Markdown rendering is bounded for very large strings.
- Generic JSONL rendering is capped at 1000 records.

The session browser groups entries as **Today / Yesterday / Earlier**. The adapter recognizes
both `response_item` messages/tool calls and Codex `event_msg` user/assistant messages, while
preserving unknown records in Trajectory and Raw. Codex runtime wrappers such as
`<recommended_plugins>`, `<environment_context>`, and approval-review transcript envelopes are
not used as session titles; review envelopes may use their embedded `[n] user:` request instead.

For a local syntax/fixture check (Node 18+):

```sh
node --test test/parse.test.js
```

## Attribution

The generic JSON-viewing direction was inspired by [viggomeesters/obsidian-json-viewer](https://github.com/viggomeesters/obsidian-json-viewer), MIT licensed. The session browser, Codex adapter, multi-view trace model, and smart-string reader are developed here.
