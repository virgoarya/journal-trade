

### [20260812] Daily Risk Limit Stale Value on Live Pipeline Start
**Area**: Backend / Trading Pipeline
**Root Cause**: Ketika trading pipeline dijalankan (`/pipeline/start`) dengan config broker yang tidak mendefinisikan `maxDailyRisk` secara eksplisit (karena bug di backtest form sebelumnya yang mengirimkan `undefined`), `DEFAULT_CONFIG` di `trading-pipeline.service.ts` tidak menyediakan nilai default untuk `maxDailyRisk` (karena sengaja di-omit). Hal ini menyebabkan nilai `maxDailyRisk` dikirim sebagai `undefined` ke `AITradingSession.findOneAndUpdate`. Karena nilainya `undefined`, Mongoose tidak memperbarui nilai tersebut di database, sehingga pipeline menggunakan nilai stale lama (misalnya 1.5%) dari sesi sebelumnya.
**Solusi**: Menambahkan nilai default `maxDailyRisk: 3.0` ke dalam `DEFAULT_CONFIG` di `trading-pipeline.service.ts` dan memperbarui interface `PipelineConfig` agar `maxDailyRisk` bertipe `number` (bukan optional `number | undefined`) untuk menyelesaikan error tipe penugasan.
**Hindari**: Pastikan parameter manajemen risiko inti (core risk control) selalu memiliki nilai default yang valid di service config dan tidak dibiarkan `undefined` agar data sesi tidak meluncur ke status stale atau tidak terdefinisi di database.
