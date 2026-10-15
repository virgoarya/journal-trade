# Hunter Trades — Frontend

> Next.js 16 App Router · Trading journal + AI trading engine · Terminal Noir theme

---

## 🚀 Quick Start

### Prerequisites

| Requirement | Version | Notes |
|---|---|---|
| **Node.js** | >= 20 | Enforced via `engines` |
| **npm** | bundled with Node | Use `package-lock.json` for reproducible installs |

### Install & Run

```bash
# Install dependencies
npm install

# Development server (hot reload)
npm run dev          # → http://localhost:3000

# Type check
npm run typecheck

# Production build
npm run build        # → .next/standalone

# Lint
npm run lint
```

---

## 📁 Structure

```
frontend/
├── src/
│   ├── app/(dashboard)/   # Dashboard, AI Trading, Macro Terminal, Analytics, etc.
│   ├── components/        # Shared UI components (Terminal Noir)
│   ├── services/          # API client services
│   ├── hooks/             # Custom React hooks
│   └── lib/               # Utility functions
├── e2e/                   # Playwright E2E tests
├── public/                # Static assets
└── package.json
```

---

## 🎨 Design System

**Terminal Noir** — dark background (`#121212`, `#1E1E1E`) with gold accent (`#D4AF37`).

- **CSS-first config** via Tailwind CSS v4 `@theme` in `globals.css`
- **Typography:** Inter / Roboto / Outfit (Google Fonts)
- **Micro-animations** on hover states
- **Accessibility:** WCAG 2.1 AA enforced

See `globals.css` for complete design tokens.

---

## 🧪 Testing

```bash
# Unit tests (Vitest)
npm run test

# E2E tests (Playwright)
npx playwright install chromium   # first time only
npx playwright test
```

---

## 🔗 Related Documentation

- [Main README](../README.md) — Project overview, architecture, setup wizard
- [Setup Wizard Guide](../docs/SETUP_WIZARD_GUIDE.md) — First-run setup field-by-field
- [User Guide MT5](../docs/USER_GUIDE_MT5.md) — Install EXE + connect MetaTrader 5
- [API Reference](../docs/API_REFERENCE.md) — `/api/v1/` endpoint reference

---

*Hunter Trades Journal · Frontend · Terminal Noir*
