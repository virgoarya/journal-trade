# Hunter Trades Journal

> Professional AI-Powered Trading Journal & Automated Pipeline System with MetaTrader 5 (MT5) Integration.

---

## 📋 Project Description

**Hunter Trades Journal** is an advanced trading management platform and automated trading pipeline designed for professional traders. It combines real-time MetaTrader 5 (MT5) account monitoring, AI-driven market analysis (RSI + Engulfing strategies), automated risk management, and a robust Next.js frontend with an Express/TypeScript backend.

---

## 🛠️ Tech Stack

- **Frontend**: Next.js 16 (App Router), React 19, Tailwind CSS, Recharts, Framer Motion
- **Backend**: Node.js, Express 5, TypeScript, Mongoose (MongoDB), Better Auth
- **MT5 Bridge / MCP**: Python MetaTrader5 library, Model Context Protocol (MCP)
- **Desktop App**: Electron (cross-platform desktop wrapper)
- **Containerization**: Docker & Docker Compose

---

## 📦 Prerequisites

Ensure you have the following installed on your system:
- **Node.js** (v20+ recommended)
- **Python** (v3.10+) with pip
- **MongoDB** (Local instance or MongoDB Atlas URI)
- **MetaTrader 5 Terminal** (running locally on Windows for MT5 bridge integration)

---

## ⚙️ Installation & Setup

1. **Clone / Open the Repository**:
   ```bash
   cd D:/Journal Trade
   ```

2. **Configure Environment Variables**:
   Copy `.env.example` to `.env` and fill in your database and API keys:
   ```bash
   cp .env.example .env
   ```

3. **Install Backend Dependencies**:
   ```bash
   cd server
   npm install
   ```

4. **Install Frontend Dependencies**:
   ```bash
   cd ../client (or frontend)
   npm install
   ```

5. **Run Database Check / Seed**:
   ```bash
   cd ../server
   npm run build
   ```

---

## 🚀 Development Workflow

To run the full stack in development mode:

1. **Start Backend Server**:
   ```bash
   cd server
   npm run dev
   ```

2. **Start Frontend Client**:
   ```bash
   cd frontend
   npm run dev
   ```

3. **Run Tests**:
   ```bash
   cd server
   npm test
   ```

---

## 🏗️ Architecture Overview

```
┌────────────────────────────────────────────────────────┐
│                   FRONTEND (Next.js)                   │
│   - App Router Pages & Components                      │
│   - Real-time Account & Position Metrics               │
└────────────────────────────────────────────────────────┘
                           │
                           ▼
┌────────────────────────────────────────────────────────┐
│                   BACKEND (Express)                    │
│   - REST API & Better Auth Authentication              │
│   - AI Trading Engine & Risk Manager                   │
└────────────────────────────────────────────────────────┘
                           │
                           ▼
┌────────────────────────────────────────────────────────┐
│                 MT5 MCP Server (Python)                │
│   - MetaTrader 5 Terminal Bridge                       │
└────────────────────────────────────────────────────────┘
```

---

## 🤝 Contributing Guidelines

1. Create a feature branch (`git checkout -b feature/amazing-feature`).
2. Commit your changes (`git commit -m 'Add amazing feature'`).
3. Push to the branch (`git push origin feature/amazing-feature`).
4. Open a Pull Request.

---

*Hunter Trades Journal · Built with Precision & AI*
