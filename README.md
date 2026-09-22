# Agent Trace Reader for Obsidian

A local-first, read-only viewer for agent traces and structured JSON/JSONL data in Obsidian.

Development happens on feature branches. The first planned release is v0.2, evolving the earlier Smart JSON Viewer into a session-oriented Agent Trace Reader.

## Principles

- Keep original trace files untouched.
- Prefer human-readable conversation views without hiding raw evidence.
- Unknown event types must remain inspectable in Raw view.
- Render long strings lazily to avoid making large traces expensive to open.
- Keep adapters separate from presentation so source formats can evolve independently.

## Attribution

This project builds on ideas and code from [obsidian-json-viewer](https://github.com/viggomeesters/obsidian-json-viewer), released under the MIT License.
