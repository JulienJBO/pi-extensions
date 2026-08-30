# pi-model-costs

Shows model pricing directly in every row of Pi's `/model` list:

```text
small-model [provider]                    ↑ $0.10  ↓  $0.40  C $0.01r/ $0.10w
large-model [provider]                    ↑ $5.00  ↓ $30.00  C $0.50r/$6.25w
```

All prices are USD per one million tokens. `↑` is input, `↓` is output, and `C` is cache pricing; `r` and `w` mean cache read and cache write.

## Install

```bash
pi install npm:@shakthi-sagar/pi-model-costs
```

Restart Pi or run `/reload`, then open `/model`.

## Notes

- Pricing comes from Pi's model catalogue, including custom `models.json` entries.
- `/model search-term` is supported.
- The list respects Pi's scoped models when model scoping is configured.
- The extension replaces the editor with Pi's standard `CustomEditor` so it can intercept the built-in `/model` command. It may conflict with another extension that installs a custom editor.
- Tiered long-context rates are not shown; rows display base rates.
