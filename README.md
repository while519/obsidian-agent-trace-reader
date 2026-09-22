# Agent Trace Reader for Obsidian

A local-first, read-only reader for agent traces. v0.2 focuses on **Codex rollout sessions** and keeps a generic Smart JSON/JSONL viewer as the raw fallback.

## Highlights

- Auto-discovers Codex rollouts under `~/.codex/sessions` (configurable).
- Session browser grouped by recency; no symlink or copying into the vault.
- Three views over the same evidence: **Conversation / Trajectory / Raw**.
- Compact Conversation mode groups system/tool/reasoning traffic into collapsible Process blocks.
- Long strings get **Rendered / Text / Raw / JSON** modes.
- Unknown record types are never dropped; inspect them in Trajectory or Raw.
- Generic `.json`, `.jsonl`, and `.ndjson` files in the vault still get a smart reader.

## Install with BRAT

Until the first stable merge/release, add this repository in BRAT and select the development branch `dev/agent-trace-reader-v0.2`.

Repository: `while519/obsidian-agent-trace-reader`

After installation, enable **Agent Trace Reader** and click the messages icon in Obsidian's left ribbon.

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
- Full parsing happens only after opening a session.
- Markdown rendering is bounded for very large strings.
- Generic JSONL rendering is capped at 1000 records.

## Attribution

The generic JSON-viewing direction was inspired by [viggomeesters/obsidian-json-viewer](https://github.com/viggomeesters/obsidian-json-viewer), MIT licensed. The session browser, Codex adapter, multi-view trace model, and smart-string reader are developed here.
