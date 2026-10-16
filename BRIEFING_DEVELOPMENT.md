# 📋 Briefing Development — Hunter Trades Journal & AI Trading

> **Tanggal:** 2026-10-05  
> **Branch:** `feat/checklist-display-only`  
> **Target:** Desktop EXE Installer (Electron 35.7.5, **packer internal** — bukan electron-builder)  
> **Versi Saat Ini:** v1.1.0

---

## 🎯 Goals Utama

### Primary Goal
Menghasilkan **Hunter Trades.exe** installer yang bisa di-install di Windows, menjalankan:
- Backend server (port 5000)
- Frontend Next.js standalone (port 3000)
- 9Router proxy (port 20128)
- Electron window dengan system tray

### Secondary Goals
1. **Stability** — App bisa berjalan 24/7 tanpa crash
2. **Auto-Update** — OTA updater via GitHub Releases
3. **Multi-User** — Support multiple users dengan Discord OAuth
4. **MT5 Integration** — Koneksi native MCP ke MetaTrader 5
5. **AI Trading** — Pure AI order execution dengan multi-methodology

---

## 📊 Current State Assessment

### ✅ What's Working (Verified)

| Component | Status | Notes |
|-----------|--------|-------|
| **Backend (Express 5)** | ✅ Stable | 51+ services, 25 routes, 25 models |
| **Frontend (Next.js 16)** | ✅ Stable | 20 pages, 13 services, Terminal Noir theme |
| **Electron Desktop** | ✅ Functional | Main process, tray, splash, OTA updater |
| **MT5 Native MCP** | ✅ Connected | Direct to port 22346, no Python bridge |
| **LLM Consensus** | ✅ Active | 9router with 6 providers + fallback |
| **Macro Terminal** | ✅ Live Data | FRED, Yahoo Finance, real-time updates |
| **AI Trading Engine** | ✅ Operational | SMC/ICT/MSNR + confluence + risk management |
| **Playbook System** | ✅ Working | ICT, MSNR, SMC methodologies |
| **Auth (Better Auth)** | ✅ Functional | Discord OAuth + session management |
| **Database (MongoDB)** | ✅ Connected | Atlas cloud, 25 collections |

### ⚠️ Known Issues (From LESSONS.md)

| Issue | Severity | Status |
|-------|----------|--------|
| Hardcoded "Bang Vir" in some services | HIGH | ✅ Fixed (2026-10-03) |
| Macro data lagging (cache TTL) | MEDIUM | ✅ Fixed (2026-10-01) |
| AI Yield Curve truncated | MEDIUM | ✅ Fixed (2026-10-03) |
| Checklist 0/0 valid glitch | MEDIUM | ✅ Fixed (2026-07-28) |
| MT5 MCP tool name mismatch | HIGH | ✅ Fixed (2026-08-04) |
| OTA update without version gate | HIGH | ✅ Fixed (2026-08-11) |
| ENCRYPTION_KEY missing in build | HIGH | ✅ Fixed (2026-08-11) |

### 🔴 Critical Path to EXE

```
1. Build Frontend (Next.js standalone)     → ~5-10 menit
2. Build Server (TypeScript → JS)          → ~1 menit
3. Build Desktop (electron-builder)        → ~3-5 menit
4. Test EXE (clean Windows environment)    → ~30 menit
5. Create OTA Patch                        → ~1 menit
6. Upload to GitHub Releases               → ~5 menit
```

---

## 📁 Project Structure

```
D:\Journal Trade\
├── frontend/                     # Next.js 16.2.1 (App Router)
│   ├── src/
│   │   ├── app/(dashboard)/      # 20 dashboard pages
│   │   ├── components/           # UI components (8 directories)
│   │   ├── services/             # 13 API client services
│   │   ├── hooks/                # Custom React hooks
│   │   └── lib/                  # Utilities & helpers
│   ├── public/                   # Static assets
│   └── package.json              # v1.1.0
│
├── server/                       # Node.js + Express 5.2.1
│   ├── src/
│   │   ├── services/             # 51+ business logic services
│   │   │   └── strategies/       # 14 strategy modules
│   │   ├── routes/               # 25 Express route files
│   │   ├── models/               # 25 Mongoose models
│   │   ├── agents/               # AI system agents
│   │   ├── middleware/           # Auth, validation, rate limiting
│   │   └── utils/                # Helpers & utilities
│   ├── mcp-mt5-server/           # Python MT5 client (legacy)
│   ├── prisma/                   # Database schema & seed
│   └── package.json              # v1.1.0
│
├── desktop/                      # Electron 35
│   ├── main.js                   # Main process (orchestrator)
│   ├── preload.js                # Preload script
│   ├── buildHooks/               # Build automation
│   │   ├── buildApp.js           # Copy resources
│   │   ├── buildPatch.js         # Create OTA patch
│   │   ├── afterPack.js          # electron-builder hook
│   │   └── copyResources.js      # Resource copier
│   ├── assets/                   # Icons, splash
│   └── package.json              # v1.1.0
│
├── update/                       # OTA update files
│   ├── version.json              # Version info
│   └── patch.zip                 # Latest patch
│
├── .kilo/                        # Agent memory & skills
│   ├── MEMORY.md                 # Architecture state
│   ├── LESSONS.md                # Lessons learned
│   └── RULES.md                  # Workflow rules
│
├── docs/                         # Documentation
├── wiki/                         # Wiki pages
└── scripts/                      # Utility scripts
```

---

## 🔧 Pre-Release Checklist

### 1. Code Quality

- [ ] **TypeScript Compilation** — `npx tsc --noEmit` (server & frontend)
- [ ] **ESLint** — No errors in frontend
- [ ] **Unit Tests** — `npm test` (server & frontend)
- [ ] **No console.log debug** — Clean up debug statements
- [ ] **No hardcoded secrets** — All in .env

### 2. Build Process

- [ ] **Frontend Build** — `npm run build` (Next.js standalone)
- [ ] **Server Build** — `npx tsc` (TypeScript → JS)
- [ ] **Desktop Build** — `node buildHooks/buildApp.js`
- [ ] **EXE Generation** — electron-builder NSIS installer
- [ ] **OTA Patch** — `node buildHooks/buildPatch.js`

### 3. Testing

- [ ] **Backend Health** — `curl http://localhost:5000/health`
- [ ] **Frontend Load** — `curl http://localhost:3000`
- [ ] **MT5 Connection** — Verify MCP connection
- [ ] **AI Pipeline** — Test signal generation
- [ ] **Auth Flow** — Test Discord OAuth
- [ ] **Macro Data** — Verify FRED/Yahoo data freshness

### 4. Security

- [ ] **ENCRYPTION_KEY** — Set in .env (48 chars)
- [ ] **BETTER_AUTH_SECRET** — Set in .env
- [ ] **MONGODB_URI** — Atlas connection string
- [ ] **Rate Limiting** — Configured in middleware
- [ ] **CORS** — Properly configured
- [ ] **HTTPS** — For production (if applicable)

### 5. Documentation

- [ ] **README.md** — Project overview & setup
- [ ] **CHANGELOG.md** — Version history
- [ ] **API Docs** — Endpoint documentation
- [ ] **User Guide** — MT5 setup & usage

---

## 🚀 Build & Release Process

### Step 1: Version Bump

```bash
# Update version in 5 files:
# - package.json (root)
# - server/package.json
# - frontend/package.json
# - desktop/package.json
# - update/version.json
```

### Step 2: Build Frontend

```bash
cd frontend
npm run build
# Output: .next/standalone/frontend/server.js
#         .next/static/
#         public/
```

### Step 3: Build Server

```bash
cd server
npx tsc
# Output: dist/
```

### Step 4: Build Desktop App

```bash
cd desktop
node buildHooks/buildApp.js
# Output: dist-app/win-unpacked/Hunter Trades.exe
```

### Step 5: Create Installer

```bash
cd desktop
npx electron-builder --win nsis
# Output: dist/Hunter Trades Setup 1.1.0.exe
```

### Step 6: Create OTA Patch

```bash
cd desktop
node buildHooks/buildPatch.js
# Output: update/patch.zip
#         update/version.json
```

### Step 7: Upload to GitHub

```bash
git add .
git commit -m "release: v1.1.0"
git push origin main
# Upload installer to GitHub Releases
```

---

## 🐛 Known Bugs & Limitations

### Bugs to Fix Before Release

| Bug | Impact | Effort |
|-----|--------|--------|
| Macro data cache TTL too long | Data lagging | Low |
| AI Yield Curve max_tokens too small | Truncated output | Low |
| Checklist 0/0 valid glitch | UI confusion | Low |
| MT5 MCP tool name mismatch | Connection failure | Medium |
| OTA update without version gate | Downgrade risk | Medium |

### Limitations

1. **MT5 Required** — App needs MetaTrader 5 running with MCP enabled
2. **Discord OAuth** — Only Discord community members can access
3. **Windows Only** — Electron app is Windows-only
4. **Local Network** — Web UI accessible from same network
5. **No Mobile App** — Mobile web UI only (responsive)

---

## 📈 Post-Release Roadmap

### v1.2.0 (Planned)
- [ ] Telegram/Discord alerts
- [ ] Multi-broker support
- [ ] Advanced risk dashboard
- [ ] Shared skill pool (multi-user)

### v1.3.0 (Planned)
- [ ] Intra-candle wick simulation
- [ ] Correlation matrix heatmap
- [ ] VaR (Value at Risk) calculation
- [ ] Drawdown distribution

### v2.0.0 (Vision)
- [ ] Mobile app (React Native)
- [ ] Cloud hosting option
- [ ] Advanced AI (GPT-4, Claude 3)
- [ ] Social trading features

---

## 👥 Team Roles

| Agent | Role | Responsibility |
|-------|------|----------------|
| **KIRA** | Orchestrator | Planning, coordination, quality gate |
| **AXIS** | Backend | API, services, database |
| **NOVA** | Frontend | UI, components, user experience |
| **RIKU** | Mobile | Mobile-responsive design |
| **FORGE** | DevOps | Build, deploy, infrastructure |
| **VERA** | QA | Testing, bug finding, verification |
| **SAGE** | Docs | Documentation, wiki, guides |
| **LYRA** | Design | UI/UX, visual design |

---

## 📝 Next Steps

1. **Review this briefing** — Team acknowledges current state
2. **Fix known bugs** — Address critical issues before build
3. **Run full test suite** — Ensure all tests pass
4. **Build EXE** — Execute build process
5. **Test on clean Windows** — Verify installer works
6. **Upload to GitHub** — Release v1.1.0
7. **Monitor** — Watch for issues after release

---

## 🔗 Important Links

- **Repository:** https://github.com/virgoarya/journal-trade
- **GitHub Releases:** https://github.com/virgoarya/journal-trade/releases
- **Wiki:** `wiki/` directory
- **Documentation:** `docs/` directory

---

*Dibuat oleh KIRA — AI/Orchestration Agent*  
*"Intelligence without alignment is just noise."*
