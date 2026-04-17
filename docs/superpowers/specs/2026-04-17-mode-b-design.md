# Mode B — 我要休 N 天 設計文件

Date: 2026-04-17

## 背景

vacay.tw 現有模式（Mode A）針對「我有 N 天特休，怎麼請最划算？」，以請假天數為輸入，找出連休天數最多的方案。

Mode B 針對「我要連休 N 天，最少需要請幾天假？」，以目標連休天數為輸入，找出所有能達到目標、且請假天數最少的方案。

## 設計決策

### 切換器

- 白色 Query Block 頂部加入 Segmented Control
- 左側：「我有假」（Mode A，現有行為）
- 右側：「我要休」（Mode B，新行為）
- 樣式：`bg-slate-100` 底、active tab `bg-white + shadow`，與現有 UI 一致

### Mode A（無變化）

- Stepper 文字：「我要**請** N 天假」
- 群組依據：`totalDays` 降冪
- 群組 label：「連休 X 天」
- 最佳 badge：「★ 最佳」

### Mode B（新增）

- Stepper 文字：「我要**休** N 天假」
- 輸入語意：目標 `totalDays`（同樣 1–30 範圍）
- 篩選邏輯：`strategy.totalDays === target`
- 群組依據：`leaveDays` 升冪（請假最少排最前）
- 群組 label：「只需請 X 天」
- 最佳 badge：「★ 最佳」（共用）

### 共用不變

- helper text：「幫我在以下時段，找出最佳連休方案」
- MonthRangePicker
- StrategyCard 樣式與行為
- 國定假日 / Freebies 區塊（仍顯示）

## 資料流

Mode B 不需要新的引擎邏輯。`ALL_STRATEGIES_FLAT` 已包含所有 `totalDays` / `leaveDays` 組合，只需在 `App.tsx` 增加一條篩選 + 分組路徑即可。

```
target = modeBDays  // user input
filtered = strategies.filter(s => s.totalDays === target && matchesMonthFilter(s) && !s.isFreebie)
groupedByLeave = groupBy(filtered, s.leaveDays).sort(leaveDays asc)
```

## 受影響的檔案

- `src/App.tsx` — 新增 `mode` state、Segmented Control UI、Mode B 篩選 + 分組邏輯
