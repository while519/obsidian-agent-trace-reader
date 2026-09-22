# Changelog

## Unreleased
- Filtered Codex runtime/approval wrappers from session titles and disambiguated repeated overview titles with short session ids.
- Made expanded Process summaries sticky while scrolling through long blocks.
- Improved session overview spacing with readable cards, section counts, and Today/Yesterday/Earlier accent colors.
- Added contextual copy actions across session paths, conversation messages, Process blocks, trajectory events, smart strings, JSON values, and loaded Raw pages.

## 0.2.0
- Added automatic local Codex session discovery.
- Added Conversation / Trajectory / Raw views.
- Added compact Process grouping for tool/system/reasoning traffic.
- Added smart long-string Rendered / Text / Raw / JSON modes.
- Kept generic JSON/JSONL/NDJSON reading as a raw fallback.
- Streamed large Codex rollouts instead of loading the whole file into one string.
- Added paged Trajectory/Raw rendering and per-event lazy hydration for large traces.
- Classified `event_msg` agent messages and mirrored item events, with safer session titles.
- Grouped sessions explicitly as Today / Yesterday / Earlier.
