---
title: Journal Insight Service
created: 2026-09-21
updated: 2026-09-21
type: entity
tags: [pipeline, module, pattern, architecture]
sources: [raw/articles/project-overview.md]
confidence: high
---

# Journal Insight Service

Service backend yang menganalisis pola trading dari data journal dan menghasilkan insight berbasis AI.

## Lokasi

    server/src/services/journal-insight.service.ts

## Fungsi Utama

    detectEmotionPatterns   Deteksi pola emosi dari model TradeEmotion
    detectTimePatterns      Deteksi pola performa per jam (NY Time UTC-4) dari AITradeLog
    getLLMInsights          Panggil LLM via 9Router untuk insight naratif
    parseInsights           Parse response LLM ke struktur {summary, strengths, weaknesses, actionItems}

## Perbaikan (2026-09-21)

1. R-Multiple aman dari division by zero: risk = Math.abs((entry || 0) - (sl || 0)), skip jika risk = 0
2. Zona waktu konsisten: konversi ke NY Time (UTC-4) via nyHour = (utcHour - 4 + 24) % 24
3. signal?.symbol dengan optional chaining, fallback 'UNKNOWN'
4. LLM response diproses via parseInsights() — menangani respons string maupun object
5. Fallback message dalam Bahasa Indonesia

## LLM Endpoint

    POST http://localhost:5000/api/v1/agent-consensus/single/journal-analyzer
    timeout: 25 detik
    via 9Router port 20128

## Data Sources

    TradeEmotion  → detectEmotionPatterns
    AITradeLog    → detectTimePatterns (requires executionTime field)

## Lihat Juga

- [[hunter-trades-journal]] — Aplikasi induk
- [[mt5-integration]] — Sumber data trade yang dianalisis
