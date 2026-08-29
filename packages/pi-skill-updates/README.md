# pi-skill-updates

A powerful extension for the [Pi coding agent](https://github.com/badlogic/pi-skills) that scans installed agent skills, detects remote updates from GitHub repositories and registries, and provides interactive update commands, automatic startup notifications, and AI agent tools.

---

## ✨ Features

- 🔍 **Multi-Source Discovery**: Scans skills tracked in `~/.agents/.skill-lock.json`, project-level lockfiles, and local skill directories.
- ⚡ **Accurate & Fast Detection**: Directly queries remote repository tree hashes via GitHub API (with batching) to instantly know if a skill has changed upstream.
- 🚀 **Interactive Slash Commands**:
  - `/skills:check` — Scans all skills, displays status, and lets you update outdated skills with a single click.
  - `/skills:update [skillName]` — Updates a specific skill or all outdated skills.
- 🔔 **Background Notifications**: Non-intrusive alert on session startup if skill updates are available.
- 🤖 **Agent Tools**: Exposes `check_skill_updates` and `update_skills` so the AI assistant can check and update skills on request.

---

## 📦 Installation

### Global Install

```bash
pi install npm:pi-skill-updates
```

Or from local directory:

```bash
pi install /path/to/pi-extensions/packages/pi-skill-updates
```

### Try Without Installing

```bash
pi -e npm:pi-skill-updates
```

---

## 🛠️ Usage

### Commands

- `/skills:check`:
  Checks all installed skills and displays a formatted summary report. If updates are found, it presents an interactive prompt to update them immediately.

- `/skills:update`:
  Updates all outdated skills.

- `/skills:update <skill-name>`:
  Updates the specified skill.

### Agent Prompts

You can also ask the AI agent:

- _"Are there any new versions of my skills available?"_
- _"Check for skill updates"_
- _"Update all my outdated skills"_

---

## 🔑 Environment Variables

- `GITHUB_TOKEN` or `GH_TOKEN` _(Optional)_: Set a personal GitHub token to avoid GitHub API rate limits when checking public repositories.

---

## 📄 License

MIT © Shakthi Sagar
