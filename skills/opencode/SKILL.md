---
name: opencode
description: Use OpenCode AI CLI agent to run, delegate, or inspect automated coding sub-tasks, refactoring, and AI-driven code generation via the opencode CLI tool.
---

# OpenCode Skill

This skill enables the assistant to leverage the `opencode` CLI tool for automated coding tasks, project analysis, refactoring, and AI agent executions.

## Command Reference

### 1. Verify Installation & Version
```powershell
cmd /c "set PATH=%ProgramFiles%\nodejs;%APPDATA%\npm;%PATH% & opencode --version"
```

### 2. Run Headless / Non-Interactive Prompt
To execute a prompt directly with OpenCode without launching an interactive shell:
```powershell
cmd /c "set PATH=%ProgramFiles%\nodejs;%APPDATA%\npm;%PATH% & opencode run \"<your prompt or instruction here>\""
```

### 3. Run OpenCode within a Specific Project Directory
```powershell
cmd /c "cd /d <path-to-project> & set PATH=%ProgramFiles%\nodejs;%APPDATA%\npm;%PATH% & opencode run \"<your instruction>\""
```

## Guidelines
- **Path environment**: Always include Node.js (`%ProgramFiles%\nodejs`) and global npm modules (`%APPDATA%\npm`) in the `PATH` variable when invoking `opencode`.
- **Headless mode**: Prefer `opencode run "<prompt>"` for non-interactive execution so output can be captured directly in automated steps.
- **Provider configuration**: OpenCode uses user-configured API keys stored in `~/.config/opencode` or environment variables (such as `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, etc.).
