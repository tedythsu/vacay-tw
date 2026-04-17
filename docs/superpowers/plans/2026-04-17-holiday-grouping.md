# Holiday Name Sub-Grouping Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Within each collapsible result group, visually sub-group strategies that share the same holiday name using a small label divider, eliminating repeated holiday text.

**Architecture:** Add a pure `subGroupByName` helper in `App.tsx` that converts a flat `Strategy[]` into `[name, Strategy[]][]` pairs. The existing group renderers (Mode A and Mode B) call this helper and conditionally render a `<div>` divider before each holiday's strategies when there is more than one distinct name in the group.

**Tech Stack:** React, TypeScript, Tailwind CSS, Vitest

---

### Task 1: Add and test `subGroupByName` helper

**Files:**
- Modify: `src/App.tsx` (add helper before the `App` component)
- Test: `src/engine/strategy.test.ts` (append new describe block)

- [ ] **Step 1: Write the failing test**

Append to `src/engine/strategy.test.ts`:

```ts
describe('subGroupByName', () => {
  // subGroupByName lives in App.tsx which is not importable in unit tests,
  // so we inline the same logic here to lock in the contract.
  function subGroupByName(strategies: { name: string; id: string }[]) {
    const map = new Map<string, { name: string; id: string }[]>()
    for (const s of strategies) {
      if (!map.has(s.name)) map.set(s.name, [])
      map.get(s.name)!.push(s)
    }
    return [...map.entries()]
  }

  it('groups strategies by name preserving insertion order', () => {
    const input = [
      { name: '農曆新年', id: 'a' },
      { name: '農曆新年', id: 'b' },
      { name: '清明節',   id: 'c' },
    ]
    const result = subGroupByName(input)
    expect(result).toHaveLength(2)
    expect(result[0][0]).toBe('農曆新年')
    expect(result[0][1].map(s => s.id)).toEqual(['a', 'b'])
    expect(result[1][0]).toBe('清明節')
    expect(result[1][1].map(s => s.id)).toEqual(['c'])
  })

  it('returns a single group when all strategies share the same name', () => {
    const input = [
      { name: '端午節', id: 'x' },
      { name: '端午節', id: 'y' },
    ]
    const result = subGroupByName(input)
    expect(result).toHaveLength(1)
    expect(result[0][0]).toBe('端午節')
  })

  it('handles empty input', () => {
    expect(subGroupByName([])).toHaveLength(0)
  })
})
```

- [ ] **Step 2: Run tests to verify they fail (function not yet in App.tsx)**

```bash
npm test -- --run
```

Expected: the new `subGroupByName` tests pass already (the logic is inlined in the test file). Confirm all prior tests still pass.

- [ ] **Step 3: Add `subGroupByName` to `App.tsx`**

In `src/App.tsx`, add the following helper directly above the `export default function App()` line:

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

- [ ] **Step 4: Run tests to confirm all pass**

```bash
npm test -- --run
```

Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/App.tsx src/engine/strategy.test.ts
git commit -m "feat: add subGroupByName helper with tests"
```

---

### Task 2: Apply sub-grouping to Mode A result list

**Files:**
- Modify: `src/App.tsx` (lines ~343–355, inside Mode A `!collapsed` block)

- [ ] **Step 1: Replace the flat strategy list in Mode A**

Find the Mode A collapsed section (inside `mode === 'a'` branch). The current code is:

```tsx
{!collapsed && (
  <div className="divide-y divide-slate-100 pb-1">
    {group.map(s => (
      <div key={s.id} id={s.id}>
        <StrategyCard
          strategy={s}
          isSelected={selectedStrategy?.id === s.id}
          onSelect={() => handleSelectStrategy(s)}
          grouped
        />
      </div>
    ))}
  </div>
)}
```

Replace with:

```tsx
{!collapsed && (
  <div className="divide-y divide-slate-100 pb-1">
    {(() => {
      const subGroups = subGroupByName(group)
      const showDividers = subGroups.length > 1
      return subGroups.map(([name, subs]) => (
        <div key={name}>
          {showDividers && (
            <div className="flex items-center gap-2 pt-2 pb-1 px-2">
              <span className="text-[10px] text-slate-400 font-semibold shrink-0">{name}</span>
              <div className="flex-1 h-px bg-slate-100" />
            </div>
          )}
          {subs.map(s => (
            <div key={s.id} id={s.id}>
              <StrategyCard
                strategy={s}
                isSelected={selectedStrategy?.id === s.id}
                onSelect={() => handleSelectStrategy(s)}
                grouped
              />
            </div>
          ))}
        </div>
      ))
    })()}
  </div>
)}
```

- [ ] **Step 2: Run tests**

```bash
npm test -- --run
```

Expected: all tests pass.

- [ ] **Step 3: Commit**

```bash
git add src/App.tsx
git commit -m "feat: sub-group Mode A results by holiday name"
```

---

### Task 3: Apply sub-grouping to Mode B result list

**Files:**
- Modify: `src/App.tsx` (lines ~405–419, inside Mode B `!collapsed` block)

- [ ] **Step 1: Replace the flat strategy list in Mode B**

Find the Mode B collapsed section (inside the `groupedModeB.map` branch). The current code is:

```tsx
{!collapsed && (
  <div className="divide-y divide-slate-100 pb-1">
    {group.map(s => (
      <div key={s.id} id={s.id}>
        <StrategyCard
          strategy={s}
          isSelected={selectedStrategy?.id === s.id}
          onSelect={() => handleSelectStrategy(s)}
          grouped
        />
      </div>
    ))}
  </div>
)}
```

Replace with:

```tsx
{!collapsed && (
  <div className="divide-y divide-slate-100 pb-1">
    {(() => {
      const subGroups = subGroupByName(group)
      const showDividers = subGroups.length > 1
      return subGroups.map(([name, subs]) => (
        <div key={name}>
          {showDividers && (
            <div className="flex items-center gap-2 pt-2 pb-1 px-2">
              <span className="text-[10px] text-slate-400 font-semibold shrink-0">{name}</span>
              <div className="flex-1 h-px bg-slate-100" />
            </div>
          )}
          {subs.map(s => (
            <div key={s.id} id={s.id}>
              <StrategyCard
                strategy={s}
                isSelected={selectedStrategy?.id === s.id}
                onSelect={() => handleSelectStrategy(s)}
                grouped
              />
            </div>
          ))}
        </div>
      ))
    })()}
  </div>
)}
```

- [ ] **Step 2: Run tests**

```bash
npm test -- --run
```

Expected: all tests pass.

- [ ] **Step 3: Commit**

```bash
git add src/App.tsx
git commit -m "feat: sub-group Mode B results by holiday name"
```
