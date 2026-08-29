# pi-extensions

A collection of modular extensions and providers for the [Pi coding agent](https://github.com/earendil-works/pi).

Each package in this repository is published independently to npm and can be installed into Pi with a single command.

---

## 📦 Packages

| Package                                                     | Version | Description                                                                                 | Install Command                        |
| :---------------------------------------------------------- | :------ | :------------------------------------------------------------------------------------------ | :------------------------------------- |
| [`pi-agy`](./packages/pi-agy)                               | `0.6.0` | Antigravity / Cloud Code Assist provider with multi-account quota failover                  | `pi install npm:pi-agy`                |
| [`pi-auto-session-title`](./packages/pi-auto-session-title) | `0.1.0` | Automatically generates concise, searchable titles for your sessions                        | `pi install npm:pi-auto-session-title` |
| [`pi-skill-updates`](./packages/pi-skill-updates)           | `0.1.0` | Scans installed skills, checks for remote updates, and provides interactive update commands | `pi install npm:pi-skill-updates`      |

---

## 🚀 Quick Start

To install any extension globally in Pi:

```bash
pi install npm:<package-name>
```

To try any extension temporarily for the current session only:

```bash
pi -e npm:<package-name>
```

To remove an extension:

```bash
pi remove npm:<package-name>
```

---

## 🛠️ Development

This monorepo uses standard npm workspaces.

### Setup

```bash
# Clone the repository
git clone https://github.com/shakthi-sagar/pi-extensions.git
cd pi-extensions

# Install dependencies for all packages
npm install
```

### Type Checking & Testing

```bash
# Typecheck all packages
npm run typecheck

# Run tests
npm test
```

### Adding a New Extension

1. Create a new directory inside `packages/pi-<name>`.
2. Add a `package.json` with `"keywords": ["pi-package"]` and a `"pi"` section.
3. Write your extension inside `src/index.ts`.
4. Run `npm install` from the root to link workspace dependencies.

---

## 📄 License

MIT © [Shakthi Sagar](https://github.com/shakthi-sagar)
