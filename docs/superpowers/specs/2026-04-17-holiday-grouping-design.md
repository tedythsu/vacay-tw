# Holiday Name Sub-Grouping Design

## Problem

Within each collapsible result group (Mode A: grouped by `totalDays`; Mode B: grouped by `leaveDays`), multiple strategies sharing the same holiday name (e.g., three variants of "農曆新年" with different date ranges) appear as repeated text. This creates visual noise.

## Solution

Add non-interactive section label dividers inside each group to visually sub-group strategies by holiday name (`strategy.name`).

## Behaviour

### Visual treatment

Within an expanded group, when strategies span more than one distinct holiday name, insert a divider before each new holiday's strategies:

```
農曆新年  ─────────────────
  2026/01/27 ～ 2026/02/04
  2026/01/25 ～ 2026/02/04
清明節  ──────────────────
  2026/04/02 ～ 2026/04/08
  2026/03/31 ～ 2026/04/08
```

Divider anatomy:
- Small grey uppercase label (holiday name)
- Right-side thin line extending to full width
- Padding: `pt-2 pb-1 px-2` inside the group container

### Suppression rule

If all strategies in a group share the same holiday name, show **no dividers** — the group header already provides context.

### Scope

- **Mode A** (`totalDays` groups): apply sub-grouping
- **Mode B** (`leaveDays` groups): apply sub-grouping
- **Freebies** (國定連假): no sub-grouping — too few items

### Ordering

Strategies within each holiday sub-group retain their existing sort order (by `start` date ascending). Holiday sub-groups are ordered by the `start` date of their first strategy.

## Implementation

### Data transformation

In `App.tsx`, after building `groupedPaid` and `groupedModeB`, add a helper that converts `Strategy[]` → `[name: string, strategies: Strategy[]][]`:

```ts
function subGroupByName(strategies: Strategy[]): [string, Strategy[]][] {
  const map = new Map<string, Strategy[]>()
  for (const s of strategies) {
    if (!map.has(s.name)) map.set(s.name, [])
    map.get(s.name)!.push(s)
  }
  return [...map.entries()]
}
```

The result preserves insertion order (first-seen holiday name first), which matches start-date ordering since strategies are already sorted by start.

### Rendering

Replace the flat `group.map(s => ...)` inside each group's expanded section with:

```tsx
{subGroupByName(group).map(([name, subs], si) => (
  <div key={name}>
    {/* Divider — only when >1 distinct holiday in this group */}
    {group_has_multiple_names && (
      <div className="flex items-center gap-2 pt-2 pb-1 px-2">
        <span className="text-[10px] text-slate-400 font-semibold shrink-0">{name}</span>
        <div className="flex-1 h-px bg-slate-100" />
      </div>
    )}
    {subs.map(s => (
      <div key={s.id} id={s.id}>
        <StrategyCard ... />
      </div>
    ))}
  </div>
))}
```

### Files changed

- `src/App.tsx` — add `subGroupByName` helper, update render for Mode A groups and Mode B groups
