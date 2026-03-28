# Hunter Trades Journal — Stitch AI Designer Prompt

## Project Overview

Design a **premium, dark-themed trading journal web application** called **"Hunter Trades Journal"**. The visual identity is **ultra-minimal and monochromatic** — a near-black background with **only ONE accent color: metallic gold (#D4AF37)**. All buttons, active states, highlights, and interactive elements use gold. There are NO other accent colors (no cyan, no purple, no blue). The only exception is semantic data coloring: green for profit and red for loss in data displays only.

**Platform type:** Desktop-first responsive web app (SaaS dashboard)
**Primary language:** Indonesian (Bahasa Indonesia) for all UI labels, buttons, and copy
**Framework context:** Next.js 14 (App Router) — design for web browser viewport
**Primary viewport:** 1440×900 desktop

---

## Design System — "Terminal Noir"

### Color Palette (Strictly 2-Tone: Black + Gold)

> **CRITICAL RULE:** The entire UI uses ONLY black/dark tones + gold (#D4AF37). No blue, no purple, no cyan, no teal. Buttons are gold. Links are gold. Active states are gold. The ONLY other colors allowed are green (#00E676) and red (#FF1744) — and ONLY for profit/loss data values, never for buttons or UI elements.

| Token | Hex | Usage |
|---|---|---|
| `bg-void` | `#050508` | App/page background (near-black) |
| `bg-surface` | `#0A0A12` | Card and panel backgrounds |
| `bg-elevated` | `#10101C` | Hover states, modal overlays, dropdowns |
| `bg-input` | `#0D0D18` | Form input field backgrounds |
| `border-subtle` | `#1A1A2E` | Card borders, dividers |
| `border-glow` | `rgba(212, 175, 55, 0.15)` | Gold glow on focus/active states |
| `text-primary` | `#E8E6E3` | Main body text (warm white) |
| `text-secondary` | `#6B7280` | Labels, captions, muted text |
| `text-muted` | `#374151` | Disabled states, placeholders |
| `accent-gold` | `#D4AF37` | **THE accent color** — all buttons, active nav, headings, links, highlights, CTA |
| `accent-gold-dim` | `#8B7722` | Muted gold for secondary elements, hover dimmed states |
| `data-profit` | `#00E676` | ONLY for profit data values (PnL numbers, equity curve line) |
| `data-loss` | `#FF1744` | ONLY for loss data values (negative PnL numbers) |
| `data-warning` | `#FFA726` | ONLY for risk warning data states (drawdown near limit) |

### Button Styles (Gold Only)

```
Primary button (CTA / Submit):
  background: #D4AF37
  color: #050508 (dark text on gold)
  border: none
  border-radius: 10px
  font-weight: 600
  padding: 12px 24px
  hover: brightness(1.1), subtle lift shadow

Secondary button (Ghost / Cancel):
  background: transparent
  color: #E8E6E3
  border: 1px solid #1A1A2E
  hover: border-color #D4AF37, color #D4AF37

Destructive button (Delete / Reset):
  background: transparent
  color: #FF1744
  border: 1px solid rgba(255, 23, 68, 0.3)
  hover: background rgba(255, 23, 68, 0.1)
```

### Glassmorphism Card Recipe

```
background: rgba(10, 10, 18, 0.7)
backdrop-filter: blur(12px)
border: 1px solid rgba(255, 255, 255, 0.06)
border-radius: 16px
```

On hover:
```
border-color: rgba(212, 175, 55, 0.12)
box-shadow: 0 0 30px rgba(212, 175, 55, 0.04)
```

### Typography

| Context | Font Family | Weight | Size | Letter Spacing |
|---|---|---|---|---|
| Page title (H1) | Inter | 700 | 30px | -0.02em |
| Section title (H2) | Inter | 600 | 24px | -0.01em |
| Card title (H3) | Inter | 600 | 18px | 0 |
| Body text | Inter | 400 | 16px | 0 |
| Labels & captions | Inter | 500 | 14px | 0.02em |
| All numeric data | JetBrains Mono | 500 | varies | 0 |

### Corner Radius
- Small (inputs, badges): `6px`
- Medium (buttons, dropdowns): `10px`
- Large (cards, panels): `16px`
- Extra large (modals): `24px`
- Full (pill buttons, avatars): `9999px`

### Input Field Style (all forms globally)
```
background: #0D0D18
border: 1px solid #1A1A2E
border-radius: 10px
padding: 12px 16px
color: #E8E6E3
font-size: 14px

Focus state:
  border-color: rgba(212, 175, 55, 0.4)
  box-shadow: 0 0 0 3px rgba(212, 175, 55, 0.08)
```

---

## Global Sidebar Navigation — CONSISTENT ACROSS ALL PAGES

> **CRITICAL:** The sidebar is the PRIMARY navigation element. It must appear **identically** on every authenticated page (PAGE 3 through PAGE 9). The sidebar never changes layout, position, or style between pages. Only the **active item highlight** changes to indicate the current page. This creates a perfectly symmetric and synchronized navigation experience.

### Sidebar + Header Layout (applies to ALL authenticated pages)

```
┌──────────────────────────────────────────────────────────┐
│  TOP HEADER BAR — height: 64px, bg: #0A0A12              │
│  [Page Title]                               [🔔] [👤▾]  │
├──────────┬───────────────────────────────────────────────┤
│          │                                               │
│ SIDEBAR  │          MAIN CONTENT AREA                    │
│ 260px    │          padding: 32px                        │
│ bg:      │          bg: #050508                          │
│ #0A0A12  │          overflow-y: auto                     │
│          │                                               │
│ ┌──────┐ │  (Content varies per page,                    │
│ │HUNTER│ │   sidebar stays identical)                    │
│ │TRADES│ │                                               │
│ └──────┘ │                                               │
│          │                                               │
│ 🏠 Dasbor│                                               │
│ 📝 Catat Trade                                           │
│ 📖 Playbook                                              │
│ 📊 Analitik                                              │
│ 🤖 AI Review                                            │
│          │                                               │
│ ──────── │                                               │
│ ⚙ Pengaturan                                            │
│ 🚪 Keluar│                                               │
│          │                                               │
│ ──────── │                                               │
│ [👤] user│                                               │
│          │                                               │
└──────────┴───────────────────────────────────────────────┘
```

### Sidebar Specifications (IMMUTABLE — same on every page)

**Structure (top to bottom, vertically balanced):**
1. **Logo Area (top, 72px height):**
   - "HUNTER TRADES" — Inter Bold, 16px, gold `#D4AF37`, letter-spacing 0.1em
   - Small crosshair/target icon to the left, also gold
   - Padding: 20px horizontal
   - Border bottom: 1px solid `#1A1A2E`

2. **Main Navigation (middle, vertically centered in available space):**
   - 5 nav items, evenly spaced, each 48px height:
     - `LayoutDashboard` icon → **Dasbor**
     - `PenLine` icon → **Catat Trade**
     - `BookOpen` icon → **Playbook**
     - `BarChart3` icon → **Analitik**
     - `Bot` icon → **AI Review**
   - Each item: icon (20px) + label (14px, Inter Medium), horizontal padding 20px
   - Gap between items: 4px

3. **Divider:** 1px line `#1A1A2E`, margin 16px horizontal, 12px vertical

4. **Utility Navigation:**
   - `Settings` icon → **Pengaturan**
   - `LogOut` icon → **Keluar**
   - Same styling as main nav items

5. **User Section (bottom, pinned to bottom of sidebar):**
   - Discord avatar (36px, round) + username (14px, `#6B7280`) + role badge chip
   - Padding: 16px 20px
   - Border top: 1px solid `#1A1A2E`

### Nav Item States (Gold-only scheme)

```
Default:
  color: #6B7280
  background: transparent
  border-left: 3px solid transparent

Hover:
  color: #E8E6E3
  background: #10101C
  border-left: 3px solid transparent

Active (current page):
  color: #D4AF37 (gold)
  background: rgba(212, 175, 55, 0.08)
  border-left: 3px solid #D4AF37
  font-weight: 600
```

### Synchronization Rules
- When user is on `/dashboard` → "Dasbor" is active (gold)
- When user is on `/log-trade` → "Catat Trade" is active (gold)
- When user is on `/playbook` or `/playbook/[id]` → "Playbook" is active (gold)
- When user is on `/analytics` → "Analitik" is active (gold)
- When user is on `/ai-review` → "AI Review" is active (gold)
- When user is on `/settings` → "Pengaturan" is active (gold)
- **All other nav items remain in default gray state.** Only ONE item is gold at a time.

### Top Header (SAME on every authenticated page)
- **Height:** 64px
- **Background:** `#0A0A12`
- **Border bottom:** 1px solid `#1A1A2E`
- **Left:** Page title text (18px, Inter Semibold, white) — changes per page
- **Right:** Notification bell icon (gold, 20px) + Discord avatar circle (32px)
- **No breadcrumbs, no hamburger on desktop** — keep it extremely clean

---

## Pages to Design

---

### PAGE 1: Masuk / Login with Discord

**Route:** `/`
**Layout:** Full-page, NO sidebar, NO header. Centered vertically and horizontally.
**Purpose:** Single-purpose login gate. Clean, minimal, no marketing fluff.

**Background:** `#050508` with a very subtle **dot grid pattern** (dots in `#1A1A2E`, spacing ~40px). Optional: very faint radial gradient glow (gold, centered behind logo, opacity 0.03).

**Content (vertically stacked, centered, max-width 400px):**

```
                  ⊕
            HUNTER TRADES

     "Jurnal trading eksklusif untuk
       member Hunter Trades"

       [ Masuk dengan Discord ]
```

1. **Logo Icon:** Crosshair/target icon, 48px, gold `#D4AF37`
2. **Title:** "HUNTER TRADES" — Inter Bold, 28px, gold `#D4AF37`, letter-spacing 0.15em
3. **Spacing:** 16px
4. **Subtitle:** "Jurnal trading eksklusif untuk member Hunter Trades" — Inter Regular, 16px, `#6B7280`, center-aligned
5. **Spacing:** 40px
6. **Login Button:** **"Masuk dengan Discord"** — gold filled button (`#D4AF37` bg, `#050508` dark text), full-width (400px), height 52px, border-radius 10px, Inter Semibold 16px, with Discord logo icon (dark) on the left. On hover: brightness(1.1) + subtle lift shadow.
7. **Spacing:** 24px
8. **Footer text:** "Khusus member komunitas Hunter Trades" — 12px, `#374151`

**No feature cards.** No marketing sections. Just logo + one button. Ultra-clean.

---

### PAGE 2: Akses Ditolak / Access Denied

**Route:** `/access-denied`
**Layout:** Full-page, NO sidebar, NO header. Centered.

**Content (vertically stacked, centered, max-width 440px):**
- Icon: **ShieldX** icon, 56px, `#FF1744`
- **Spacing:** 20px
- Heading: **"AKSES DIBATASI"** — 28px, Inter Bold, `#E8E6E3`
- **Spacing:** 12px
- Message: "Akun Discord Anda belum terdaftar sebagai member Hunter Trades atau belum memiliki role yang diperlukan." — 15px, `#6B7280`, center-aligned
- **Spacing:** 32px
- Primary button: **"Gabung Hunter Trades"** — gold filled button (same style as login button), full-width
- **Spacing:** 12px
- Secondary link: **"Coba masuk ulang"** — text link, gold `#D4AF37`, 14px, underline on hover

---

### PAGE 3: Onboarding Wizard (3 Steps)

**Route:** `/onboarding`
**Layout:** Full-page, NO sidebar. Centered card, max-width 640px.
**Note:** This page has NO sidebar because user hasn't completed setup yet.

**Stepper Progress Bar (top of card):**
- 3 steps connected by a line
- Completed step: filled gold circle + gold text
- Active step: gold circle outline with subtle pulse
- Pending step: gray circle `#374151` + gray text
- Labels: `"1. SELAMAT DATANG"` · `"2. AKUN TRADING"` · `"3. ATURAN RISIKO"`

**Step 1 — Selamat Datang:**
- Discord avatar (64px, rounded, border 2px solid `#D4AF37`)
- Text: "Halo, **{username}**! Mari setup jurnal trading Anda." — 20px, white
- Description: "Proses ini hanya membutuhkan 2 menit dan hanya dilakukan sekali." — 14px, `#6B7280`
- Button: **"Mulai Setup →"** — gold filled button

**Step 2 — Konfigurasi Akun:**
- Form fields (stacked vertically, 16px gap):
  - **Nama Akun** — text input, placeholder "contoh: Akun FTMO Challenge"
  - **Saldo Awal** — currency input with "$" prefix, placeholder "10,000"
  - **Mata Uang** — dropdown select: USD, IDR
  - **Broker** — text input, optional tag, placeholder "contoh: ICMarkets"
- Buttons: "← Kembali" (ghost/secondary) + "Lanjut →" (gold filled)

**Step 3 — Parameter Risiko:**
- Form fields:
  - **Drawdown Harian Maks (%)** — slider (gold track) + number input, default 5%
  - **Drawdown Total Maks (%)** — slider (gold track) + number input, default 10%
  - **Maks Trade per Hari** — number input, optional, placeholder "tidak dibatasi"
- **Preview Card:** glassmorphism card below the inputs, gold top border accent:
  ```
  📋 Ringkasan Aturan Anda
  ─────────────────────────
  Saldo Awal:          $10,000
  Drawdown Harian:     5% ($500)
  Drawdown Total:      10% ($1,000)
  Maks Trade/Hari:     Tidak dibatasi
  ```
  Values in JetBrains Mono, gold color.
- Button: **"Aktifkan Dasbor ✓"** — gold filled, full-width

---

### PAGE 4: Dasbor / Dashboard — Risk Control Center

**Route:** `/dashboard`
**Layout:** Sidebar (Dasbor = active/gold) + Header (title: "Dasbor") + Bento Grid content
**Purpose:** "Command center" — trader must understand risk status in 5 seconds.

**Bento Grid Layout (3 columns on desktop):**

```
┌───────────────┬───────────────────────────┬────────────────┐
│               │                           │                │
│  RINGKASAN    │     KURVA EKUITAS         │  TRADE HARI    │
│  AKUN         │     (Area Chart)          │  INI           │
│  +            │                           │  (Compact      │
│  GAUGE        │     Timeframe pills:      │   List)        │
│  RISIKO       │     1M | 3B | 6B | Semua  │                │
│               │                           │                │
├───────────────┴───────────────────────────┴────────────────┤
│  STRIP METRIK (6 KPI cards in a row)                       │
│  Win Rate | Profit Factor | Avg Win | Avg Loss |           │
│  Total Trades | Streak Terbaik                             │
├──────────────────────────┬─────────────────────────────────┤
│                          │                                 │
│  HEATMAP PnL HARIAN      │  PANEL STATUS RISIKO            │
│  (Calendar grid)         │  (Progress bars + badge)        │
│                          │                                 │
└──────────────────────────┴─────────────────────────────────┘
```

**Component: Ringkasan Akun (top-left card)**
- Card title: "Ringkasan Akun" — H3, 18px, semibold, white
- **Ekuitas Saat Ini:** `$12,450.00` — JetBrains Mono, 32px, bold, **gold color**
- **PnL Hari Ini:** `+$340.00 ▲` green or `-$120.00 ▼` red — 16px mono (data colors only)
- **Nama Akun:** "Akun FTMO Challenge" — 14px, `#6B7280`
- **Broker:** "ICMarkets" — 12px, `#374151`

**Component: Gauge Risiko (inside left card, below account summary)**
- **2 circular SVG gauge meters** side by side (120px diameter each)
- Outer ring track: `#1A1A2E` (dark gray)
- Arc fill: **gold `#D4AF37`** for normal range (0-80% of limit)
- Arc fill: `#FF1744` red when >80% of limit (danger zone, with pulsing glow)
- Center text: current % (e.g. "2.3%") in JetBrains Mono, bold, white
- Label below each: "DD Harian (Maks 5%)" — 11px, `#6B7280`

**Component: Kurva Ekuitas (center, largest card)**
- Area chart (TradingView style)
- Line color: `#D4AF37` (gold, NOT green — keep the monochrome theme)
- Area fill: gradient from `rgba(212, 175, 55, 0.12)` to transparent
- X-axis: dates, Y-axis: dollar values (mono font), axis labels in `#374151`
- Dotted line at **High-Water Mark**, labeled "HWM" in gold
- **Timeframe pills** at top-right: `1M | 3B | 6B | Semua` — active pill = gold bg + dark text, inactive = transparent + muted text

**Component: Trade Hari Ini (right card)**
- Card title: "Trade Hari Ini" — H3, white
- Compact list rows:
  ```
  XAUUSD   LONG ↑   +$340   London Breakout
  EURUSD   SHORT ↓  -$120   SMC Sweep
  ```
  - Pair: white, bold 14px
  - Direction: "LONG ↑" green text / "SHORT ↓" red text (data semantic only)
  - PnL: mono, green/red (data semantic only)
  - Playbook: small chip, `#1A1A2E` bg, `#6B7280` text
- Bottom link: **"Lihat Semua →"** — gold text, 14px
- Empty state: "Belum ada trade hari ini." — muted, with gold link "Catat trade pertamamu →"

**Component: Strip Metrik (6 KPI cards, horizontal row)**
- Each card: glassmorphism, ~200px wide
  - Small icon (16px, **gold**)
  - Label: "Win Rate" — 12px, `#6B7280`, uppercase
  - Value: "67.3%" — JetBrains Mono, 24px, **white**
  - Trend arrow: "▲ 2.1%" green or "▼ 0.5%" red — 12px (data semantic only)

| KPI | Contoh Nilai |
|---|---|
| Win Rate | 67.3% |
| Profit Factor | 1.84 |
| Rata-rata Win | $312 |
| Rata-rata Loss | $178 |
| Total Trade | 142 |
| Streak Terbaik | 8 win |

**Component: Panel Status Risiko (bottom-right)**
- Title: "Status Risiko" — H3, white
- **2 horizontal progress bars:**
  - Bar track: `#1A1A2E`
  - Bar fill: **gold `#D4AF37`** for normal, red `#FF1744` for danger (>80%)
  - "Drawdown Harian: 32% dari 5%"
  - "Drawdown Total: 18% dari 10%"
- **Status badge:**
  - **"AMAN"** — gold text, `rgba(212, 175, 55, 0.1)` bg, gold border
  - **"PERINGATAN"** — `#FFA726` text, orange tinted bg (only when 50-80%)
  - **"DILANGGAR"** — `#FF1744` text, red tinted bg, pulsing border (only when >80%)

---

### PAGE 5: Catat Trade / Trade Logger

**Route:** `/log-trade`
**Layout:** Sidebar (Catat Trade = active/gold) + Header (title: "Catat Trade Baru") + 2-column content (60% / 40%)

**Left Column (60%) — Form inside a glassmorphism card:**

**Grup 1 — Informasi Dasar:**
- **Tanggal & Waktu** — DateTime picker, default: now
- **Pair / Aset** — Searchable dropdown: XAUUSD, EURUSD, GBPUSD, USDJPY, GBPJPY, AUDUSD, NAS100, US30
- **Arah** — Toggle: `LONG` / `SHORT` — active LONG = data-green bg, active SHORT = data-red bg
- **Playbook** — Dropdown from user's playbooks. Placeholder: "Pilih playbook..."

**Grup 2 — Data Keuangan:**
- **Harga Entry** — Number, monospace, placeholder "0.00000"
- **Stop Loss** — Number, monospace
- **Take Profit** — Number, monospace, "(opsional)" label
- **Ukuran Lot** — Number, placeholder "0.01"
- **PnL Aktual ($)** — Number, monospace, text green if positive / red if negative

**Grup 3 — Metrik:**
- **R-Multiple** — Auto-calculated, editable. Hint: "Otomatis = PnL / Risiko"
- **Hasil** — 3-way toggle: `WIN` (green data) / `LOSS` (red data) / `IMPAS` (gray)

**Grup 4 — Psikologi & Catatan:**
- **Kondisi Emosi** — 5-point emoji scale: 😡 Tilt · 😟 Cemas · 😐 Netral · 🙂 Tenang · 😌 Percaya Diri. Active = gold ring glow.
- **Catatan** — Textarea, 4 rows, placeholder "Apa yang Anda pelajari dari trade ini?"
- **Tautan Grafik** — URL input, placeholder "https://www.tradingview.com/chart/..."

**Submit:** **"Simpan Trade"** — gold filled, full form width. Secondary: "Batal" — ghost style.

**Right Column (40%) — Panel Pratinjau Risiko (sticky):**
- Title: **"Dampak Trade Ini"** — H3, gold icon
- Content in JetBrains Mono:
  ```
  Ukuran Posisi        0.50 lot
  Risiko (SL)          $250.00
  Risiko (% Ekuitas)   2.0%
  ─────────────────────────────
  Jika trade ini LOSS:
    DD Harian:  2.3% → 4.3%
    DD Total:   4.1% → 6.1%
  ```
- Progress bars: gold fill, same as dashboard risk bars
- ⚠️ Warning if exceeds limit: "Peringatan: Trade ini melampaui batas drawdown!" — `#FFA726` border + bg tint

---

### PAGE 6: Manajer Playbook

**Route:** `/playbook`
**Layout:** Sidebar (Playbook = active/gold) + Header (title: "Playbook Saya") + Card grid

**Page header right:** **"+ Buat Playbook"** — gold filled button

**Card Grid (3 columns desktop), each card glassmorphism:**
```
┌────────────────────────────────────┐
│  📖  London Breakout               │
│  ────────────────────────────────  │
│  Pairs:    GBPUSD · EURUSD        │
│  Sesi:     London                  │
│  ────────────────────────────────  │
│  Win Rate    68%    (34/50)        │
│  Rata-rata R  1.8R                 │
│  Total Trade  50                   │
│                                    │
│  [Edit]     [Lihat Detail →]       │
└────────────────────────────────────┘
```
- Best playbook: **gold border** with subtle glow
- Stats values: JetBrains Mono, white
- "Lihat Detail →" — gold text link
- "Edit" — ghost/secondary button
- Empty state: "Anda belum memiliki playbook." + gold CTA "Buat Playbook"

**Create/Edit Playbook — Modal (640px wide, glassmorphism):**
- Fields: Nama, Deskripsi, Pair (multi-select tags), Sesi (dropdown), Aturan/Checklist (repeatable + button), Tag
- Buttons: "Batal" (ghost) + **"Simpan Playbook"** (gold filled)

---

### PAGE 6b: Detail Playbook

**Route:** `/playbook/[id]`
**Layout:** Sidebar (Playbook = active/gold) + Header (title: playbook name)

- **Header:** Playbook name (H1) + **"Edit"** ghost button + pair tag chips
- **Section: Aturan Trading** — numbered checklist, each in subtle card row
- **Section: Statistik** — KPI strip (Win Rate, Total Trade, Avg R, Profit Factor)
- **Section: Kurva Ekuitas** — mini area chart, gold line (same as dashboard)
- **Section: Trade Terkini** — last 10 trades, compact table

---

### PAGE 7: Analitik / Performance Analytics

**Route:** `/analytics`
**Layout:** Sidebar (Analitik = active/gold) + Header (title: "Analitik") + full-width scrolling

**Header Controls:**
- **Periode:** Pill tabs `Harian | Mingguan | Bulanan | Semua` — active = gold bg
- **Rentang Tanggal:** Date range picker
- **Filter:** Pair chips + Playbook chips — active filter chips have gold border

**Section 1 — Metrik Utama (KPI strip with sparklines):**
- Win Rate, Profit Factor, Rata-rata Win, Rata-rata Loss, Ekspektasi, Rasio Sharpe
- Sparkline: gold line, tiny

**Section 2 — PnL dari Waktu ke Waktu:**
- Combo chart: green/red bars (data semantic) + gold line (cumulative PnL)
- Tooltip on hover

**Section 3 — Breakdown per Pair:**
- Title: "Performa per Pair"
- Horizontal bar chart: bars in gold (positive) / red (negative data)
- Data table below (mono numbers, green/red PnL data values)

**Section 4 — Breakdown per Playbook:**
- Title: "Performa per Playbook"
- Donut chart: shades of gold and muted tones (avoid rainbow — use gold, gold-dim, warm grays)
- Insight: "🏆 Playbook Terbaik: *London Breakout* (68% WR, 2.1 PF)" — gold border card

**Section 5 — Riwayat Trade (paginated table):**
- Filter chips: `Semua | Win | Loss | Impas` — active = gold
- Sortable columns, alternating row bg
- Row click → expand inline detail
- Pagination controls

---

### PAGE 8: AI Trade Review

**Route:** `/ai-review`
**Layout:** Sidebar (AI Review = active/gold) + Header (title: "AI Trade Review") + 2-column

**Left Column (55%) — Review Feed:**

Each review card (glassmorphism):
```
┌──────────────────────────────────────────────┐
│  🤖  Review Trade #142                       │
│  XAUUSD · LONG · +$340 · London Breakout     │
│  28 Mar 2026, 14:30                          │
│  ──────────────────────────────────────────  │
│                                              │
│  ✅ Kekuatan:                                │
│  • Entry sesuai aturan playbook              │
│  • R:R ratio 1:2.5                           │
│  • Risiko terkendali (2% per trade)          │
│                                              │
│  ⚠️ Catatan Perbaikan:                       │
│  • Pertimbangkan trailing stop               │
│  • Emosi "Cemas" — waspadai overtrade        │
│                                              │
│  📊 Skor: 8.2/10                             │
│  ──────────────────────────────────────────  │
│  [Lihat Detail Trade →]                      │  ← gold link
└──────────────────────────────────────────────┘
```
- Score "8.2/10" in **gold**, bold, JetBrains Mono
- "Lihat Detail Trade →" — gold link

**Right Column (45%) — Ringkasan AI (sticky card):**
```
┌────────────────────────────────┐
│  🧠 Ringkasan Mingguan AI      │
│  ──────────────────────────── │
│                                │
│  Skor Rata-rata:   7.8/10     │  ← gold, mono
│  Tingkat Disiplin: 85%        │  ← white, mono
│  Kepatuhan Playbook: 92%     │  ← white, mono
│                                │
│  📝 Rekomendasi Utama:         │
│  "Tingkatkan konsistensi      │
│   pada sesi New York..."      │  ← #6B7280 italic
│                                │
│  [Lihat Laporan Lengkap →]    │  ← gold link
└────────────────────────────────┘
```

---

### PAGE 9: Pengaturan / Settings

**Route:** `/settings`
**Layout:** Sidebar (Pengaturan = active/gold) + Header (title: "Pengaturan") + single column (max-width 720px)

**Section 1 — Profil:**
- Discord avatar (80px, round, gold border 2px) + username + "Member sejak: 15 Jan 2026"
- Read-only display

**Section 2 — Akun Trading:**
- Fields: Nama Akun, Saldo Awal, Mata Uang, Broker
- Button: **"Simpan Perubahan"** — gold filled

**Section 3 — Aturan Risiko:**
- Fields: Drawdown Harian Maks (%), Drawdown Total Maks (%), Maks Trade/Hari
- Sliders with gold track + thumb
- Button: **"Perbarui Aturan"** — gold filled

**Section 4 — Manajemen Data:**
- **"Ekspor ke CSV"** — ghost/secondary button with download icon
- **"Reset Semua Data"** — destructive button (red outline, NOT gold)
  - Confirmation modal: "Apakah Anda yakin? Semua data akan dihapus permanen."
  - "Batalkan" (ghost) + "Ya, Reset" (red filled)

---

## Micro-Animations

| Trigger | Animation |
|---|---|
| Page load | Content fades up 8px, 300ms ease-out |
| Card hover | Border glows gold (0.12 opacity), subtle 2px lift |
| Number changes | Count-up/down rolling animation, 500ms |
| Risk gauge update | Arc fills smoothly, 600ms ease-in-out |
| Trade submitted | Subtle gold particle burst, 800ms |
| Sidebar nav change | Gold left border slides in, 200ms |
| Toast notification | Slides in from bottom-right, 300ms |
| Drawdown breach | Pulsing red border glow, 1.5s infinite |
| Button click | Scale 0.97 → 1.0, 100ms |
| Modal open | Backdrop fade + card scale 0.95→1, 250ms |

---

## Empty States

| Page | Message |
|---|---|
| Dashboard | "Belum ada data. Mulai catat trade pertama Anda." + gold CTA "Catat Trade →" |
| Trade list | "Belum ada trade hari ini. Catat trade pertamamu →" (gold link) |
| Playbook | "Anda belum memiliki playbook." + gold CTA "Buat Playbook" |
| Analytics | "Data analitik akan muncul setelah Anda mencatat beberapa trade." |
| AI Review | "AI review akan tersedia setelah Anda memiliki minimal 5 trade." |

---

## Key Design Principles

1. **Monochromatic discipline** — The entire UI uses ONLY dark tones + gold. No blue, no purple, no cyan anywhere in the interface. Green and red appear ONLY on data values (PnL, profit/loss indicators).
2. **Sidebar is law** — The sidebar is visually identical on every authenticated page. Only the active highlight moves. This creates rhythm and predictability.
3. **Gold = interactive** — If something is clickable, tappable, or actionable, it is gold. If it's static data, it is white or gray.
4. **Monospace for money** — All financial data uses JetBrains Mono.
5. **5-second rule** — Dashboard risk status must be understood in 5 seconds.
6. **Glassmorphism consistency** — All cards use the same glass recipe.
7. **Indonesian labels, English trading terms** — Keep Win Rate, Profit Factor, R-Multiple, Long/Short in English.
