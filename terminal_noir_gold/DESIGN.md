# Design System Specification: Terminal Noir

## 1. Overview & Creative North Star
**Creative North Star: "The Elite Ledger"**
This design system moves beyond the "app" aesthetic into the realm of high-end digital horology and terminal-based luxury. We are building a "Terminal Noir" experience—an ultra-minimalist, monochromatic environment where information is currency.

The layout rejects the traditional "grid-of-boxes" in favor of **Intentional Asymmetry**. By using heavy-weight typography against vast negative space and "ghost" containers, we create an editorial feeling that conveys authority. The goal is for the user to feel like they are looking at a private, high-stakes ledger, not a consumer tool.

---

## 2. Color Architecture
The palette is rooted in absolute depth. We use `#050508` as our void, building layers of light only where focus is earned.

### Core Tokens
- **Background (`surface-dim`):** `#050508` — The primary canvas.
- **Surface (`surface-container`):** `#0A0A12` — Base for cards and panels.
- **Accent (`primary`):** `#D4AF37` (Metallic Gold) — The "Golden Thread" that guides the eye. Used for all intent-based actions.
- **Semantic Data (Numeric Only):** 
    - `Profit`: `#00E676` 
    - `Loss`: `#FF1744`
    - `Warning`: `#FFA726`

### The "No-Line" Rule
Traditional 1px solid borders are strictly prohibited for structural sectioning. To define a new area, use a **Background Shift**. Place a `surface-container-high` element against a `surface-dim` background. The transition in tone is the boundary.

### Glass & Gradient Rule
For elements that require "floating" (Modals, Dropdowns, Hover States), utilize **Glassmorphism**:
- **Fill:** `surface-variant` at 40% opacity.
- **Backdrop Blur:** `12px`.
- **Inner Glow:** 1px stroke using `white` at 0.06 opacity to catch the "light."

---

## 3. Typography: Editorial Precision
We contrast the humanistic clarity of **Inter** with the cold, mechanical precision of **JetBrains Mono**.

- **Display & Headline (Inter Bold):** Use for large "Overview" titles and P&L summaries. The bold weight against the dark background provides the "Noir" impact.
- **Labels & UI (Inter Medium):** Use for all Indonesian UI labels (e.g., *Riwayat Transaksi*, *Analisis Jurnal*).
- **Numeric Data (JetBrains Mono):** Every price, percentage, and timestamp must use this monospace font to maintain the "Terminal" aesthetic.

| Level | Token | Font | Size | Case |
| :--- | :--- | :--- | :--- | :--- |
| Display | `display-lg` | Inter Bold | 3.5rem | Sentence |
| Title | `title-lg` | Inter Bold | 1.375rem | Sentence |
| Label | `label-md` | Inter Medium | 0.75rem | All Caps (Track 5%) |
| Data | `body-md` | JetBrains Mono | 0.875rem | Monospace |

---

## 4. Elevation & Depth
Depth in this system is achieved through **Tonal Layering**, not shadows.

- **The Layering Principle:** Stack `surface-container-lowest` on top of `surface-dim`. For a secondary level of importance, stack a `surface-container-highest` element within that. This "nesting" creates a physical sense of hierarchy.
- **Ambient Shadows:** Only used for floating "Glass" elements. Use a blur of `24px` with a `4%` opacity of the `primary` (Gold) color. This creates a subtle "gold leaf" glow beneath the element.
- **The Ghost Border:** If a boundary is required for accessibility, use the `outline-variant` token at `20%` opacity. It should be felt, not seen.

---

## 5. Components

### Tombol (Buttons)
Buttons are the primary vehicle for the Metallic Gold accent.
- **Primary (Filled):** Background `#D4AF37`, Text `#050508` (Bold). Corner radius: `10px`.
- **Ghost:** Border 1px `#D4AF37` at 40% opacity, Text `#D4AF37`. On hover, increase opacity to 100%.
- **Sidebar Nav:** Vertical layout. Active state indicated by a 2px vertical "Gold Thread" on the far left and a subtle `surface-container-high` background shift.

### Kartu (Cards)
- **Styling:** Glassmorphism (12px blur), 1px white 0.06 border, Corner radius: `16px`.
- **Rule:** Never use dividers inside cards. Separate "Entry" and "Exit" data using `1.75rem` (`spacing-8`) of vertical whitespace.

### Bidang Input (Inputs)
- **State:** `surface-container-low` background, `10px` radius.
- **Focus:** Border transitions to `primary` (Gold) at 50% opacity. Label (Indonesian) floats above in `label-sm`.

### Terminal Data Chips
- **Usage:** For "Long/Short" tags or "Asset Class."
- **Visual:** JetBrains Mono font, 1px ghost border, no background fill unless active.

---

## 6. Do’s and Don’ts

### Do
- **Use Indonesian for UI:** Ensure labels like *Tambah Jurnal*, *Keuntungan Bersih*, and *Pengaturan* are consistently used.
- **Embrace Monospace:** Use JetBrains Mono for *all* numbers. It communicates accuracy and a "pro" environment.
- **Negative Space:** Allow sections to breathe. A premium journal is not "cramped."

### Don’t
- **No Divider Lines:** Do not use `<hr>` or thin grey lines to separate list items. Use tonal shifts in the background.
- **No Standard Grays:** Every "neutral" color should have a slight blue/violet tint (`#0A0A12`) to keep the "Noir" depth.
- **No Semantic Overuse:** Do not use Green/Red for UI elements (buttons/icons). Those colors are reserved **strictly** for financial profit/loss values. All other interactions are Gold.

---

## 7. Language Reference (Bahasa Indonesia)
| English Label | Indonesian Translation |
| :--- | :--- |
| Total Profit | Total Laba |
| Trade History | Riwayat Transaksi |
| Win Rate | Tingkat Kemenangan |
| Entry Price | Harga Masuk |
| Exit Price | Harga Keluar |
| Journal Entry | Entri Jurnal |
| Settings | Pengaturan |