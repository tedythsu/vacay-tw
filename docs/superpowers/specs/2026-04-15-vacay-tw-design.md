# vacay-tw Design Spec
**Date:** 2026-04-15
**Project:** vacay-tw（台灣最強請假攻略）
**URL:** vacay.tw

---

## 1. 專案概覽

單頁靜態工具網站，幫台灣上班族找出 CP 值最高的請假時機。使用者無需輸入任何資料，點選年份即可看到所有「請 X 休 Y」策略，並透過月曆視覺化呈現。主要傳播管道為 Line / Threads，流量核心為 SEO 與分享圖卡病毒式擴散。

## 2. 技術棧

| 項目 | 選擇 | 理由 |
|------|------|------|
| 框架 | Vite + React 18 + TypeScript | 輕量，bundle < 300KB 可達成，500KB 硬限制內 |
| 樣式 | Tailwind CSS | 原子化 CSS，行動端優先 |
| 日期 | date-fns（tree-shaking） | 台灣連假計算需要可靠的日期工具 |
| 分享圖卡 | html-to-image | 將隱藏 DOM 節點截成 PNG |
| QR Code | qrcode.react（~14KB） | 分享圖卡右下角導回網址 |
| 部署 | Vercel（替換現有 project） | 零設定 CI/CD，自訂網域 vacay.tw |

## 3. 資料夾結構

```
vacay-tw/
├── public/
│   └── og-image.png              # 靜態 SEO 分享圖（1200×630）
├── src/
│   ├── data/
│   │   └── holidays.json         # 唯一數據來源
│   ├── engine/
│   │   └── strategy.ts           # 純函式，無副作用
│   ├── components/
│   │   ├── StrategyCard.tsx
│   │   ├── Calendar.tsx
│   │   ├── AdSlot.tsx
│   │   └── ShareCard.tsx
│   ├── App.tsx                   # 狀態管理、URL hash、年份切換
│   └── main.tsx
├── index.html                    # SEO meta tags
└── vite.config.ts
```

## 4. 資料模型

### holidays.json

```json
{
  "2026": [
    {
      "name": "農曆新年",
      "nameEn": "Lunar New Year",
      "start": "2026-01-27",
      "end": "2026-02-01",
      "type": "holiday",
      "is_official": true
    },
    {
      "name": "春節補班",
      "start": "2026-01-17",
      "end": "2026-01-17",
      "type": "makeup_work",
      "is_official": true
    }
  ],
  "2027": [
    {
      "name": "農曆新年",
      "nameEn": "Lunar New Year",
      "start": "2027-02-06",
      "end": "2027-02-14",
      "type": "holiday",
      "is_official": false
    }
  ]
}
```

**`type` 值：** `"holiday"` | `"makeup_work"`
**`is_official`：** `true` = 人事行政總處公告，`false` = 農曆推估（2027 大部分為 false）

### Strategy 介面

```ts
interface Strategy {
  id: string                   // slugify 生成，可直接用於 URL hash
  name: string                 // "春節"
  year: number
  leaveDays: number            // 實際需請天數（含補班日代價）
  totalDays: number            // 整段連休天數
  cpValue: number | null       // totalDays / leaveDays；isFreebie 時為 null（不參與排序）
  start: string                // ISO date，連假第一天
  end: string                  // ISO date，連假最後一天
  suggestedLeaveDates: string[]
  holidayDates: string[]
  weekendDates: string[]
  isFreebie: boolean           // leaveDays = 0 的「免請假」策略
  isOfficial: boolean          // 資料是否來自官方公告
  isSuperCombo: boolean        // 跨節日合併的「大禮包」策略
}
```

## 5. 策略引擎（engine/strategy.ts）

### 核心函式

```ts
calculateStrategies(year: number, holidays: HolidayData): Strategy[]
```

輸入某年假日資料，輸出排序好的 `Strategy[]`。

### 演算法流程

1. **遍歷每個節日**，找出原始假期區間
2. **向前後延伸週末**，計算「裸假」總天數
3. **枚舉請假擴展方案**（M, N 最大值均為 3，避免無意義長方案）：
   - 前補 N 天（N = 1, 2, 3）
   - 後補 N 天（N = 1, 2, 3）
   - 前 M 天 + 後 N 天組合（M + N ≤ 5，最多前 3 後 3，總枚舉 < 30 種）
4. **對每個方案呼叫 `calculateEffectiveLeave()`**：
   ```ts
   const calculateEffectiveLeave = (start, end, holidays) => {
     // 遍歷區間每天
     // 平日且非國定假日 → leaveDays++
     // makeup_work 日 → leaveDays++（若不在 suggestedLeaveDates 則為隱性成本）
     return leaveDays;
   };
   ```
5. **計算 totalDays**：
   - 掃描補班日是否落在連假區間內但**不在**請假日中 → `totalDays - 1`
6. **過濾**：`cpValue < 2.0` 的方案捨棄
7. **免請假策略**：`leaveDays = 0` 的方案標記 `isFreebie: true`，不計 CP 值
8. **跨節日後處理**：兩節日 gap ≤ 3 工作日 → 合併生成 `isSuperCombo: true` 的大禮包策略（2026 中秋+國慶為典型案例）
9. **去重**：相同 `[start, end]` 保留 CP 值最高者；CP 相同保留 start 較早者
10. **排序**：`isFreebie` 置頂 → `cpValue` 降序

### 涵蓋節日

| 節日 | 2026 | 2027（估） | 典型 CP |
|------|------|-----------|---------|
| 農曆新年 | ✓ | ✓ | 2.5–4.0 |
| 228 和平紀念日 | ✓ | ✓ | 2.0–4.0 |
| 兒童節/清明 | ✓ | ✓ | 2.0–4.0 |
| 端午節 | ✓ | ✓ | 2.0–3.0 |
| 中秋節 | ✓ | ✓ | 2.0–3.0 |
| 國慶日 | ✓ | ✓ | 2.0–4.0 |
| 勞動節 | ✓ | ✓ | 1.0–3.0 |

## 6. 組件規格

### App.tsx

- 狀態：`selectedYear`、`selectedStrategy`
- URL hash 雙向同步（格式：`#{strategy.id}`，year 已包含在 id 內，如 `#lunar-new-year-2027`）：
  - 選卡片時 → 使用 `window.history.replaceState(null, '', '#' + strategy.id)`（非 `location.hash` 賦值），避免 Back stack 堆積，讓使用者按上一頁直接離站
  - 啟動時 → 讀 `location.hash`，從 id 尾端解析年份（`-2026`/`-2027`），自動設定 `selectedYear` + `selectedStrategy`，滾動定位並展開月曆
- 策略列表插入 AdSlot：第 2、4 位置（0-indexed: index 1、3）

### StrategyCard.tsx

Props: `strategy: Strategy, isSelected: boolean, onSelect: () => void`

顯示：
- 節日名稱、「休 N 天」大標題、日期範圍
- CP 值（大字）、請假天數、連休天數、「賺到」天數
- `isOfficial: false` → 顯示「預估」badge（黃底）
- `isSuperCombo: true` → 顯示「大禮包 🎁」badge
- `isFreebie: true` → 顯示「免請假 🎉」badge，不顯示 CP 值

### Calendar.tsx

Props:
```ts
{
  month: string          // "2027-02"
  holidayDates: string[]
  leaveDates: string[]
  weekendDates: string[]
}
```

- 純展示，接收三種日期陣列渲染顏色
- 紅色：`holidayDates`
- 黃色：`leaveDates`
- 灰色：`weekendDates`
- 月份導航（上一月/下一月），跨月自動連顯

### AdSlot.tsx

```tsx
<div
  className="adsbygoogle min-h-[250px] w-full"
  data-ad-client="ca-pub-XXXXXXXXXXXXXXXX"
  data-ad-slot="XXXXXXXXXX"
/>
```

`min-height: 250px` 防止廣告載入前的 CLS（Layout Shift）。

### ShareCard.tsx

- 隱藏於畫面外（`absolute -left-[9999px]`），固定寬度 375px
- 截圖前等待 `document.fonts.ready`
- 內容：
  - vacay.tw logo + 年份標題
  - 節日名稱、「請 N 天 → 連休 N 天」
  - CP 值大字
  - 日期範圍
  - 月曆色塊縮圖：
    - 請假日（suggestedLeaveDates）→ 亮黃色 `#FDE047`（在 Line 小圖預覽中辨識度最高）
    - 國定假日（holidayDates）→ 柔和紅 `#FDA4AF`
    - 週末（weekendDates）→ 淺灰 `#E2E8F0`
  - QR Code（qrcode.react，導回 `vacay.tw/#${strategy.id}`）
  - 底部：`vacay.tw | 台灣最強請假攻略`

## 7. SEO

```html
<!-- index.html -->
<title>2026-2027 台灣請假攻略 | vacay.tw</title>
<meta name="description" content="一鍵找出 2026、2027 最高 CP 值請假時機。春節請 3 天休 9 天、國慶請 1 天休 4 天，台灣最強請假懶人包。">
<meta name="keywords" content="2026請假攻略,2027連假,台灣請假懶人包,請假CP值,春節連假">
<meta property="og:title" content="2026-2027 台灣最強請假攻略 | vacay.tw">
<meta property="og:description" content="春節請 3 天休 9 天。一鍵找出最高 CP 值請假策略。">
<meta property="og:image" content="https://vacay.tw/og-image.png">
<meta property="og:url" content="https://vacay.tw">
<meta name="twitter:card" content="summary_large_image">
```

OG Image 為靜態（MVP 限制），動態分享靠下載 PNG 圖卡彌補。

## 8. UI 風格規範

- **整體氛圍**：白色底 + 大圓角（`rounded-2xl`）+ 柔和陰影（`shadow-sm`），日系極簡風
- **字體**：標題 `font-bold`，內文系統無襯線（`font-sans`，在 iOS 為 SF Pro，Android 為 Roboto，Windows 為微軟正黑）
- **互動感**：策略卡片加 `hover:scale-[1.02] transition-transform`
- **isFreebie 卡片**：淡綠色背景（`bg-green-50 border-green-200`），強制置頂，吸引力標記
- **主色調（白底模式）**：
  - Accent：`#0ea5e9`（sky-500）
  - 假日：`#fee2e2`（red-100）/ `#dc2626`（red-600）
  - 建議請假：`#fef9c3`（yellow-100）/ `#ca8a04`（yellow-600）
  - 週末：`#f1f5f9`（slate-100）
  - isFreebie：`#f0fdf4`（green-50）/ `#16a34a`（green-600）

## 9. 非功能性需求

| 需求 | 目標 | 實作方式 |
|------|------|---------|
| Bundle 大小 | < 500KB | Vite tree-shaking，date-fns 按需引入 |
| 行動端適配 | iPhone/Android + Line 內建瀏覽器 | Tailwind mobile-first，max-w-lg 居中 |
| 載入速度 | Line 內建瀏覽器快開 | 純靜態，無 API call，holidays.json 在 build time import |
| 後端依賴 | 無 | 完全靜態，Vercel 純 CDN 服務 |

## 10. 廣告位佈局

- 策略列表第 2 張卡片位置（index 1）
- 策略列表第 4 張卡片位置（index 3）
- 使用 `AdSlot` 組件，`min-height: 250px` 防 CLS

## 11. 2027 預估假表聲明

- 年份 Tab 顯示「2027 預估」badge
- 每張 `is_official: false` 的策略卡片顯示「預估」badge
- 頁腳加入免責聲明：「2027 年假表依農曆週期預估，正式請假請依行政院人事行政總處公告為準。」
- `holidays.json` 的 `is_official` 欄位：官方公告後只需改布林值 + 微調日期

## 12. 2026 已確認節日（部分）

- 農曆新年：2026-01-27 ~ 2026-02-01（官方）
- 228：2026-02-28（官方）
- 兒童節：2026-04-04（官方）
- 勞動節：2026-05-01（官方）
- 端午節：2026-06-19（官方）
- 中秋節：2026-10-06（官方）
- 國慶日：2026-10-10（官方）

## 13. 2027 預估節日

- 農曆新年：2027-02-06 ~ 2027-02-14（農曆推算，除夕 2/6 週六）
- 228：2027-02-28（固定日）
- 兒童節：2027-04-04（固定日，待確認週調）
- 勞動節：2027-05-01（固定日）
- 端午節：2027-06-09（農曆五月初五）
- 中秋節：2027-09-25（農曆八月十五）
- 國慶日：2027-10-10（固定日）
