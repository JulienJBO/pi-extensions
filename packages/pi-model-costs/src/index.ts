import {
  CustomEditor,
  DynamicBorder,
  type ExtensionAPI,
  type ExtensionContext,
} from "@earendil-works/pi-coding-agent";
import type { Model } from "@earendil-works/pi-ai";
import {
  Container,
  fuzzyFilter,
  Input,
  type SelectItem,
  SelectList,
  Text,
} from "@earendil-works/pi-tui";

function formatRate(rate: number): string {
  if (rate === 0) return "$0";
  if (rate >= 1) return `$${rate.toFixed(2).replace(/\.00$/, "")}`;
  return `$${rate.toFixed(3).replace(/0+$/, "").replace(/\.$/, "")}`;
}

interface CostColumnWidths {
  input: number;
  output: number;
  cacheRead: number;
  cacheWrite: number;
}

function formattedCosts(model: Model<any>) {
  return {
    input: formatRate(model.cost.input),
    output: formatRate(model.cost.output),
    cacheRead: formatRate(model.cost.cacheRead),
    cacheWrite: formatRate(model.cost.cacheWrite),
  };
}

export function costLabel(
  model: Model<any>,
  widths?: CostColumnWidths,
): string {
  const costs = formattedCosts(model);
  return [
    `↑ ${costs.input.padStart(widths?.input ?? 0)}`,
    `↓ ${costs.output.padStart(widths?.output ?? 0)}`,
    `C ${costs.cacheRead.padStart(widths?.cacheRead ?? 0)}r/${costs.cacheWrite.padStart(widths?.cacheWrite ?? 0)}w`,
  ].join("  ");
}

function modelKey(model: Model<any>): string {
  return `${model.provider}\0${model.id}`;
}

async function showCostModelSelector(ctx: ExtensionContext, search?: string) {
  if (ctx.mode !== "tui") return;

  const scoped = ctx.scopedModels.map(({ model }) => model);
  const catalogue =
    scoped.length > 0 ? scoped : ctx.modelRegistry.getAvailable();
  const models = catalogue.sort((a, b) => {
    if (ctx.model && modelKey(a) === modelKey(ctx.model)) return -1;
    if (ctx.model && modelKey(b) === modelKey(ctx.model)) return 1;
    return a.provider.localeCompare(b.provider) || a.id.localeCompare(b.id);
  });

  const byKey = new Map(models.map((model) => [modelKey(model), model]));
  const costs = models.map(formattedCosts);
  const costWidths: CostColumnWidths = {
    input: Math.max(0, ...costs.map((cost) => cost.input.length)),
    output: Math.max(0, ...costs.map((cost) => cost.output.length)),
    cacheRead: Math.max(0, ...costs.map((cost) => cost.cacheRead.length)),
    cacheWrite: Math.max(0, ...costs.map((cost) => cost.cacheWrite.length)),
  };
  const items: SelectItem[] = models.map((model) => ({
    value: modelKey(model),
    label: `${model.id} [${model.provider}]`,
    description: costLabel(model, costWidths),
  }));

  const selected = await ctx.ui.custom<string | null>(
    (tui, theme, keybindings, done) => {
      const container = new Container();
      container.addChild(
        new DynamicBorder((text: string) => theme.fg("accent", text)),
      );
      container.addChild(
        new Text(
          theme.fg("accent", theme.bold("Select Model")) +
            theme.fg("dim", "  USD / 1M tokens"),
          1,
          0,
        ),
      );

      const searchInput = new Input();
      searchInput.setValue(search ?? "");
      container.addChild(searchInput);

      const listTheme = {
        selectedPrefix: (text: string) => theme.fg("accent", text),
        selectedText: (text: string) => theme.fg("accent", text),
        description: (text: string) => theme.fg("muted", text),
        scrollInfo: (text: string) => theme.fg("dim", text),
        noMatch: (text: string) => theme.fg("warning", text),
      };
      const listLayout = {
        // SelectList defaults the left column to 32 characters. Preserve the
        // complete model/provider label and sacrifice pricing first when narrow.
        minPrimaryColumnWidth: 1,
        maxPrimaryColumnWidth: Math.max(
          1,
          ...items.map((item) => item.label.length + 2),
        ),
      };
      const makeList = (visibleItems: SelectItem[]) => {
        const next = new SelectList(
          visibleItems,
          Math.min(Math.max(visibleItems.length, 1), 12),
          listTheme,
          listLayout,
        );
        next.onSelect = (item) => done(item.value);
        next.onCancel = () => done(null);
        return next;
      };
      const filterItems = (query: string) =>
        query
          ? fuzzyFilter(items, query, (item) => {
              const model = byKey.get(item.value);
              return `${item.label} ${model?.name ?? ""}`;
            })
          : items;

      let list = makeList(filterItems(searchInput.getValue()));
      container.addChild({
        render: (width: number) => list.render(width),
        invalidate: () => list.invalidate(),
        handleInput: (data: string) => list.handleInput(data),
      });
      container.addChild(
        new Text(
          theme.fg(
            "dim",
            "↑↓ navigate · type to search · enter select · esc cancel",
          ),
          1,
          0,
        ),
      );
      container.addChild(
        new DynamicBorder((text: string) => theme.fg("accent", text)),
      );

      let focused = false;
      return {
        get focused() {
          return focused;
        },
        set focused(value: boolean) {
          focused = value;
          searchInput.focused = value;
        },
        render: (width: number) => container.render(width),
        invalidate: () => container.invalidate(),
        handleInput: (data: string) => {
          if (
            keybindings.matches(data, "tui.select.up") ||
            keybindings.matches(data, "tui.select.down") ||
            keybindings.matches(data, "tui.select.confirm") ||
            keybindings.matches(data, "tui.select.cancel")
          ) {
            list.handleInput(data);
          } else {
            searchInput.handleInput(data);
            list = makeList(filterItems(searchInput.getValue()));
          }
          tui.requestRender();
        },
      };
    },
  );

  if (!selected) return;
  // setModel belongs to ExtensionAPI, so selection is completed by the caller.
  return byKey.get(selected);
}

export default function modelCosts(pi: ExtensionAPI) {
  pi.on("session_start", (_event, ctx) => {
    if (ctx.mode !== "tui") return;

    let editor: CustomEditor | undefined;
    ctx.ui.setEditorComponent((tui, theme, keybindings) => {
      editor = new CustomEditor(tui, theme, keybindings);
      return editor;
    });

    // Pi wires its normal submit handler after constructing a custom editor. Wrap
    // that handler so only /model is replaced; every other command stays native.
    const nativeSubmit = editor?.onSubmit;
    if (!editor || !nativeSubmit) return;
    editor.onSubmit = (text: string) => {
      const trimmed = text.trim();
      if (trimmed === "/model" || trimmed.startsWith("/model ")) {
        editor?.setText("");
        const search = trimmed.startsWith("/model ")
          ? trimmed.slice(7).trim()
          : undefined;
        void showCostModelSelector(ctx, search).then(async (model) => {
          if (!model) return;
          if (!(await pi.setModel(model))) {
            ctx.ui.notify(
              `No authentication configured for ${model.provider}/${model.id}`,
              "error",
            );
          }
        });
        return;
      }
      nativeSubmit(text);
    };
  });
}
