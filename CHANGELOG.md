# Changelog

## 0.2.0 - 2026-09-22
- Added per-trace file change detection with an explicit Auto-follow toggle; default change notices do not parse until Refresh is requested.
- Batched large Process copy reads asynchronously through one open handle per source file.
- Split the source into `src/sources/codex.js`, shared utilities, and views, with an esbuild-generated root artifact and CI build validation.
- Made the session overview use the full pane width and added lightweight title/cwd/id/path/archive search over the loaded session list.
- Filtered Codex bootstrap/runtime wrappers from the Conversation projection while retaining them in Trajectory and Raw; approval-review envelopes now show their embedded user request.
- Added `CODEX_HOME`/`~/.codex` discovery for both active and archived sessions, with Archived overview markers.
- Made CI run the parser/large-trace test suite and gated releases on an exact tag/manifest version match.
- Added a lightweight manual **Refresh trace** action for sessions that are still running; refresh re-reads the current file without background polling.
- Filtered Codex runtime/approval wrappers from session titles and disambiguated repeated overview titles with short session ids.
- Made expanded Process summaries sticky while scrolling through long blocks.
- Improved session overview spacing with readable cards, section counts, and Today/Yesterday/Earlier accent colors.
- Added contextual copy actions across session paths, conversation messages, Process blocks, trajectory events, smart strings, JSON values, and loaded Raw pages.

- Added automatic local Codex session discovery.
- Added Conversation / Trajectory / Raw views.
- Added compact Process grouping for tool/system/reasoning traffic.
- Added smart long-string Rendered / Text / Raw / JSON modes.
- Kept generic JSON/JSONL/NDJSON reading as a raw fallback.
- Streamed large Codex rollouts instead of loading the whole file into one string.
- Added paged Trajectory/Raw rendering and per-event lazy hydration for large traces.
- Classified `event_msg` agent messages and mirrored item events, with safer session titles.
- Grouped sessions explicitly as Today / Yesterday / Earlier.
