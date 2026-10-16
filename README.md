# Agent Trace Reader for Obsidian

A local-first, read-only reader for agent traces. It focuses on **Codex rollout sessions** and structured JSON/JSONL inspection inside Obsidian.

## Highlights

- Auto-discovers Codex rollouts under `$CODEX_HOME` or `~/.codex`, including both `sessions/` and `archived_sessions/` (configurable).
- Session browser grouped by recency; no symlink or copying into the vault.
- Session overview searches the loaded sessions by title, cwd, id, archive state, or trace path.
- Session overview uses separated, color-coded recency sections and readable cards.
- Filters Codex runtime/bootstrap wrappers from titles; repeated titles get a short session-id suffix in the overview.
- Four complementary views over the same evidence: **Conversation / Explorer / Trajectory / Raw**.
- Explorer uses a turn-grouped event list with timestamp position, tool-call/result pairing only where call IDs match, and a detail inspector for content, JSON fields, and raw evidence.
- The new structured-data inspector supports lazy tree expansion, paging for large arrays and JSONL, JSON Pointer navigation, and key/value/path search.
- Running traces can be manually re-read with **Refresh trace**; the live update path is event-driven rather than fixed-interval polling.
- An open trace watches only its own file for changes; **Auto** can follow new records, while the default mode shows a lightweight refresh notice.
- Compact Conversation mode groups system/tool/reasoning traffic into collapsible Process blocks.
- Expanded Process blocks keep their summary reachable while scrolling, so long blocks can be collapsed without returning to the top.
- Long strings get **Rendered / Text / Raw / JSON** modes.
- Copy actions are available for session paths, messages, Process blocks, events, JSON values, and loaded Raw pages.
- Unknown record types are never dropped; inspect them in Trajectory or Raw.
- Generic `.json`, `.jsonl`, and `.ndjson` files in the vault still get a smart reader.

## Install

### Community Plugins

Submission to the Obsidian Community Plugins directory is planned. Once it is listed, install it from:

`Settings → Community plugins → Browse → Agent Trace Reader`

### BRAT

Until the Community Plugins listing is available, install the current public release with [BRAT](https://github.com/TfTHacker/obsidian42-brat):

1. Install and enable **BRAT** in Obsidian.
2. Run **BRAT: Add a beta plugin for testing**.
3. Enter `while519/obsidian-agent-trace-reader`.
4. Enable **Agent Trace Reader** under Community plugins.

The latest stable release is **0.3.0**, available from [GitHub Releases](https://github.com/while519/obsidian-agent-trace-reader/releases).

### Manual installation

Download `main.js`, `manifest.json`, and `styles.css` from the latest GitHub Release and place them in:

`<Vault>/.obsidian/plugins/agent-trace-reader/`

Reload Obsidian, then enable **Agent Trace Reader**.

Click the messages icon in Obsidian's left ribbon to open sessions.

The default Codex home is:

```text
$CODEX_HOME or ~/.codex
```

The reader scans `sessions/` and `archived_sessions/` below that home. Archived sessions are marked
in the overview. Change the home under **Settings → Agent Trace Reader** if needed.

## Design

```text
Codex JSONL
   ↓ src/sources/codex.js
Normalized events / projections
   ├─ Conversation
   ├─ Explorer
   ├─ Trajectory
   └─ Raw
```

The plugin entry and Obsidian views live in `src/main.js` and `src/views.js`;
the source adapter is isolated so another trace format can be added without
putting its parser inside the view layer.

The normalization layer is presentation-only. Original records remain available, and malformed/unknown lines do not invalidate the rest of a session.

## Safety / performance

- Read-only access to trace files.
- Session list reads only a small prefix for metadata/title.
- Opening a trace streams JSONL instead of reading the whole file into one JavaScript string.
- Large traces keep line offsets and normalized metadata in memory; event bodies and raw lines load on demand.
- Refreshing a trace re-reads the current file snapshot, so newly appended complete lines become available without copying the trace into the vault.
- Trajectory and Raw use paged rendering, and compact Conversation keeps Process bodies collapsed until opened.
- Copying an event or Process hydrates only when the action is invoked; Raw offers a bounded **Copy loaded** action.
- Process copying uses asynchronous batched reads, so large tool/reasoning blocks do not synchronously open and close one file descriptor per event.
- Markdown rendering is bounded for very large strings.
- Generic JSONL rendering is capped at 1000 records.

The session browser groups entries as **Today / Yesterday / Earlier**. The Conversation projection
filters Codex bootstrap/runtime user wrappers while leaving them available in Trajectory and Raw;
approval-review envelopes show their embedded user request. The adapter recognizes
both `response_item` messages/tool calls and Codex `event_msg` user/assistant messages, while
preserving unknown records in Trajectory and Raw. Codex runtime wrappers such as
`<recommended_plugins>`, `<environment_context>`, and approval-review transcript envelopes are
not used as session titles; review envelopes may use their embedded `[n] user:` request instead.

For a local syntax/fixture check (Node 18+):

```sh
npm ci
npm run check
```

The repository keeps the source under `src/` and generates the root `main.js`
artifact with esbuild. Releases still contain only `main.js`, `manifest.json`,
and `styles.css`.


## Privacy and local file access

This desktop-only plugin reads Codex rollout files **outside your Obsidian vault**. It looks under the configured Codex home (by default `$CODEX_HOME` or `~/.codex`) in the `sessions/` and `archived_sessions/` folders. The files are opened read-only; the plugin does not copy or modify them and does not send trace contents to a server. It does not include telemetry or an account requirement.

Agent traces can contain secrets, credentials, personal data, and private code. Treat copied JSON, exported content, and screenshots accordingly. The Explorer inspector currently opens the Markdown tab by default, and rendering Markdown containing remote images may load those external resources through Obsidian. For sensitive or untrusted trace content, consider restricting network access or using the Content / Fields / Raw tabs. The plugin itself does not include its own network client or telemetry.

## Trace Explorer data semantics

The Explorer uses interface patterns inspired by [Langfuse](https://langfuse.com) and [Pydantic Logfire](https://pydantic.dev/logfire), without copying their UI source code. Codex rollout JSONL is an event stream rather than OpenTelemetry traces. A tool duration is shown only when a `call_id` pairs a call and result and both events have valid ordered timestamps. Missing IDs or timestamps produce **unknown duration**; no artificial nesting, token costs, or success statuses are inferred. Turn grouping is a reading aid, not a recorded parent-span hierarchy.

## Attribution

This project originally began with a modified version of the MIT-licensed [viggomeesters/obsidian-json-viewer](https://github.com/viggomeesters/obsidian-json-viewer). The generic JSON inspector has since been replaced by a new structured-data implementation, while Codex source adapters, session navigation, trace models and explorer interfaces were developed for this project. Historical attribution and copyright notices are preserved; project history is not represented as clean-room development.
