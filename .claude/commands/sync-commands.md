---
description: Sync shared commands from trustdesign-setup to all active project repos
---

# Sync Commands: $ARGUMENTS

Copy all shared commands from this repo (the single source of truth) into
every active project's `.claude/commands/` directory. Run this after editing
any shared command.

> **Read `.claude/SHARED_CONFIG.md` first.**

---

## Step 1 — Identify active projects

Active projects that need shared commands synced:

```bash
PROJECTS=(
  "$HOME/Projects/trustdesign/gitlist/.claude/commands"
  "$HOME/Projects/trustdesign/cultlux/website/.claude/commands"
  "$HOME/Projects/trustdesign/starter-web/.claude/commands"
  "$HOME/Projects/trustdesign/starter-native/.claude/commands"
)
```

If `$ARGUMENTS` contains a project name (e.g. `sync-commands gitlist`), only
sync to that project.

---

## Step 2 — Sync

For each project directory:

1. Check it exists
2. Copy all `.md` files from this repo's `.claude/commands/` into it
3. Count files synced

```bash
SOURCE="$(pwd)/.claude/commands"
SYNCED=0
SKIPPED=0

for TARGET in "${PROJECTS[@]}"; do
  if [ -d "$TARGET" ]; then
    cp "$SOURCE"/*.md "$TARGET/"
    echo "  ✓ $TARGET"
    ((SYNCED++))
  else
    echo "  ✗ $TARGET (not found — skipped)"
    ((SKIPPED++))
  fi
done
```

---

## Step 3 — Summary

```
Commands synced

  Source : {this repo}/.claude/commands/ ({N} commands)
  Synced : {SYNCED} projects
  Skipped: {SKIPPED} projects (not found)

  Projects updated:
    ✓ gitlist
    ✓ cultlux
    ✓ starter-web
    ✓ starter-native
```

---

## Notes

- Run this from the trustdesign-setup repo after editing any shared command
- This does NOT delete repo-specific commands (apply-brand, new-component, etc.)
  — it only copies shared commands in, overwriting older versions
- To add a new project to the sync list, edit this command file
