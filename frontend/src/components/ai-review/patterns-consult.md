HERMES BRIEFING: Konsultasi Ide #1 — Self-Learning Trade Journal (Frontend Components)

1. Komponen apa yang dibutuhkan?
   - EmotionHeatmap: heatmap grid emosi (fear/greed) per session/day
   - TimePerformanceChart: chart equity over time/win rate per timeframe
   - MethodologyDelta: side-by-side comparison "before vs after" atau "signal vs actual"
   - InsightCards: kartu card grid yang menampilkan LLM insights & actionable items

2. Visualisasi untuk heatmap emosi vs win rate?
   - Gunakan pattern Heatmap.tsx yang sudah ada (grid 7 sessions x N days)
   - Setiap cell warna: gold = profit (↑), red = loss (↓), muted = net zero
   - Cell opacity intensity = magnitude of PnL
   - Tooltip hover: detail trade count + sentiment label (e.g., "FOMO entry", "Breakout follow-through")
   - Alternatif: bar variant (SessionPerformanceChart style) untuk perbandingan win rate per session

3. Menampilkan LLM insights actionable?
   - InsightCards: card kecil (grid 2-3 kolom) dengan:
     • Header: emoji + title (e.g., "⚠️ High Risk Setup")
     • Body: quote dari llmInsights
     • Action: button "Add to Journal" / "Ignore" / "Mark Reviewed"
     • Progress tag: dot yang berubah warna (unread → read → archived)
   - Format: `<div class="glass p-4 rounded-xl border border-white/5 hover:border-accent-gold/20 transition">`
   - Setiap insight memiliki `actionId` untuk tracking user response

4. Reusable chart component yang sudah ada?
   - ✅ Heatmap — sudah ada di `/src/components/analytics/Heatmap.tsx` (grid session/day)
   - ✅ EquityCurveChart — sudah ada (AreaChart equity over time)
   - ✅ SessionPerformanceChart — sudah ada (Bar chart per-session PnL)
   - ✅ SignalChart — baru dibuat untuk patterns tab (line chart dengan signal markers)
   - ✅ DashboardCard — KPI cards reusable
   - → What's MISSING: EmotionHeatmap khusus untuk emotions (fear/greed) + TimePerformanceChart untuk win rate per timeframe. Keduanya bisa dibangun dengan pola Heatmap/EquityCurve.

5. Loading state & error handling pattern di project ini?
   - **Loading**: `glass-panel` dengan `RefreshCw animate-spin text-accent-gold/50` + teks "`{symbol}` {timeframe}"
   - **Error**: border `neon-red/40` + teks error di atas input + `AlertCircle` icon
   - **Empty state**: Center-aligned `RefreshCw animate-spin` + italic caption "`{no data}`"
   - Pattern umum: semua component cek `if (!data || data.length === 0)` di awal dan render placeholder
   - Error boundaries: `AsyncErrorBoundary.tsx` sudah ada di `/components/macro-terminal/`
   - Form errors: border merah + pesan di bawah input, tombol submit disabled saat processing
   - Global: Next.js `not-found` + 404 halaman, `UpdateNotification.tsx` untuk toast alerts

**Ringkasan rekomendasi untuk /ai-review patterns tab:**
```
<Grid class="grid-cols-1 lg:grid-cols-3 gap-6">
  <EmotionHeatmap data={patterns.emotionPatterns} />
  <TimePerformanceChart data={patterns.timePatterns} />
  <InsightCards data={patterns.llmInsights} />
</Grid>
```

Setiap component pakai pola: data check → skeleton loading → error state → content.
All use glass panels, neon accent gold for positive, neon red for negative, text-muted for neutral.