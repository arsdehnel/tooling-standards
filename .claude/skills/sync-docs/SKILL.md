---
name: sync-docs
description: Update project context docs and memory at the end of a session. Reviews what changed, updates .claude/CLAUDE.md, .claude/rules/*.md, and project memory files.
disable-model-invocation: true
allowed-tools: Read, Edit, Write, Bash(git log *), Bash(git diff *)
---

# Sync Docs

Review what changed this session and update the project context files so the next session starts with accurate information.

## Recent commits
!`git log --oneline -10`

## What to review and update

**1. `.claude/CLAUDE.md`** — Update if any of the following changed:
- New CLI commands or significant command changes
- New handlers added to `src/handlers/registry.ts`
- Changes to the `tooling-standards.yaml` schema
- Conventions that were established or changed (diff labels, terminology, etc.)
- Environment requirements

**2. `.claude/rules/handlers.md`** — Update if:
- A new handler was added (add to Current Handlers list)
- Handler patterns or gotchas were discovered
- Testing conventions for handlers changed

**3. Project memory** (`~/.claude/projects/-Users-adamdehnel-Projects-arsdehnel-tooling-standards/memory/`) — Add or update memory files if:
- User gave feedback on approach or behavior (feedback memory)
- A significant project decision was made (project memory)
- A new external resource was identified (reference memory)

## Rules

- Only update what actually changed — don't rewrite for the sake of it
- Keep `.claude/CLAUDE.md` lean; it loads every session
- After updating, commit the changes with `chore: update session docs`
- If nothing meaningful changed, say so and skip the commit
