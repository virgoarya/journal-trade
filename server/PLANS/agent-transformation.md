# Plan: Transform Hawk, Dove, and Contrarian into Autonomous AI Agents (like Hermes)

## Goal
Mengubah persona chat Hawk, Dove, dan Contrarian dari sekadar model LLM statis dengan system prompt menjadi **Autonomous AI Agents** mandiri yang memiliki:
1. **Tool-use loop mandiri** (dapat memanggil internal tools & MCP tools secara otonom).
2. **Autonomous Decision Making & Consensus Engine** (diskusi multi-agen otomatis).
3. **Memory & Self-Improvement** (pencatatan lessons dan memori jangka panjang via `LESSONS.md` dan MongoDB).
4. **Autonomous Cron/Trigger** (bisa melakukan scan market berkala tanpa harus dipanggil user).

---

## Architecture Plan

### 1. Agent Runtime & Persona Definitions (`server/src/agents/`)
- Buat agent class otonom (`BaseAgent`, `HawkAgent`, `DoveAgent`, `ContrarianAgent`).
- Setiap agent memiliki:
  - **Identitas unik & Mandat** (Hawk: Risk & Tightening, Dove: Akomodasi & Bullish, Contrarian: Devil's Advocate).
  - **Toolbox akses mandiri** (GeoRisk, Economic Calendar, News, MT5 MCP, Internal Tools).
  - **Autonomous Loop**: Observe -> Think -> Tool Call -> Conclude.

### 2. Multi-Agent Consensus & Debate Engine (`server/src/services/agent-consensus.service.ts`)
- Ketika user meminta analisis trading/makro, sistem memicu **Autonomous Debate**:
  - **Step 1 (Hawk)**: Analisis risiko pengetatan & likuiditas.
  - **Step 2 (Dove)**: Analisis peluang akomodasi & risk-on.
  - **Step 3 (Contrarian)**: Menyerang asumsi kedua agen di atas (Devil's Advocate).
  - **Step 4 (CEO/Synthesis)**: Menghasilkan konsensus akhir yang actionable.

### 3. Integration with Frontend (`frontend/src/components/macro-terminal/`)
- Update `/ai-review` dan `/macro-terminal/intelligence` untuk menampilkan *agent thought process* (langkah-langkah tool call dan perdebatan antar agen secara live via WebSocket).

### 4. Self-Improvement & Memory Loop (`server/src/services/self-improvement.service.ts`)
- Setiap interaksi agent dicatat ke `LESSONS.md` dan di-indeks ke MongoDB agar agen belajar dari keputusan trading sebelumnya.

---

## Execution Steps

1. **Phase 1: Agent Core Classes** (`server/src/agents/base.agent.ts`, `hawk.agent.ts`, dll.)
2. **Phase 2: Consensus & Debate Pipeline** (`server/src/services/agent-consensus.service.ts`)
3. **Phase 3: WebSocket & Frontend Live Stream** (Real-time agent thought process)
4. **Phase 4: Verification & Testing** (Jalankan test suite dan verifikasi otonomi agent)
