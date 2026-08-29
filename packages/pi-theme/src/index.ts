import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

const KNOWN_THEMES = [
  "dark",
  "light",
  "monokai",
  "nord",
  "solarized-dark",
  "solarized-light",
  "gruvbox",
  "catppuccin-mocha",
  "catppuccin-latte",
  "dracula",
  "tokyo-night",
  "one-dark",
  "github-dark",
  "github-light",
];

export default function themeExtension(pi: ExtensionAPI) {
  pi.registerCommand("theme", {
    description: "Switch TUI theme (interactive selection or /theme <name>)",
    getArgumentCompletions: (prefix: string) => {
      const filtered = KNOWN_THEMES.filter((t) =>
        t.toLowerCase().startsWith(prefix.toLowerCase()),
      );
      return filtered.length > 0
        ? filtered.map((t) => ({ value: t, label: t }))
        : null;
    },
    handler: async (args, ctx) => {
      const themeName = args.trim().toLowerCase();
      const themes = ctx.ui.getAllThemes();

      if (themeName) {
        const found = themes.find(
          (t: { name: string }) => t.name.toLowerCase() === themeName,
        );
        if (!found) {
          ctx.ui.notify(
            `Theme "${args.trim()}" not found. Available: ${themes.map((t: { name: string }) => t.name).join(", ")}`,
            "error",
          );
          return;
        }
        const res = ctx.ui.setTheme(found.name);
        if (res.success) {
          ctx.ui.notify(`Theme switched to "${found.name}"`, "info");
        } else {
          ctx.ui.notify(`Failed to set theme: ${res.error}`, "error");
        }
        return;
      }

      // Interactive selector when no argument is given
      const options = themes.map((t: { name: string }) => t.name);
      const selected = await ctx.ui.select("Select Theme", options);
      if (selected) {
        const res = ctx.ui.setTheme(selected);
        if (res.success) {
          ctx.ui.notify(`Theme switched to "${selected}"`, "info");
        } else {
          ctx.ui.notify(`Failed to set theme: ${res.error}`, "error");
        }
      }
    },
  });
}
