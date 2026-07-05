# Hunter Trades AI Provider Strategy & Fallback System

Dokumen ini menjelaskan arsitektur integrasi AI, prioritas provider, logika fallback, serta konfigurasi environment di dalam project **Hunter Trades**.

---

## 🧭 Ringkasan Arsitektur AI
Aplikasi menggunakan pola integrasi AI hibrida untuk menyeimbangkan antara **kecepatan (speed)**, **kualitas penalaran (reasoning)**, **kemampuan pemanggilan alat (function calling/MCP)**, dan **efisiensi biaya (cost-efficiency)**.

Terdapat dua pola eksekusi AI di backend:
1. **Dual-Engine Pipeline (Non-Streaming & Streaming)**: Untuk tugas-tugas terstruktur seperti analisis data makro, pembuatan ringkasan (explainer), dan scoring sentimen.
2. **Agentic System (Vercel AI SDK + MCP)**: Chatbot interaktif (AiPersonaChatPanel) yang mampu mengeksekusi tools eksternal dari server Model Context Protocol (MCP) untuk mengambil data real-time.

---

## ⚡ 1. Dual-Engine Pipeline (Completions)
Logika ini diimplementasikan di `server/src/services/macro-ai.service.ts` lewat fungsi `callDualEngine` dan `callDualEngineStream`.

### Alur Fallback & Prioritas:
```
[Request] ──► 1. Groq (Llama 3.3) ──► Sukses? ──► [Selesai]
                   │ (Gagal/Rate Limit/5xx)
                   ▼
              2. Groq (Llama 3.1) ──► Sukses? ──► [Selesai]
                   │ (Gagal/Rate Limit/5xx)
                   ▼
              3. Google Gemini (Gemini 2.5 Flash Direct API) ──► Sukses? ──► [Selesai]
                   │ (Gagal)
                   ▼
              [Error Log & Null Response]
```

### Karakteristik:
- **Groq Llama 3.3/3.1 (Utama)**: Dipilih karena memiliki latensi super rendah (token-per-second sangat tinggi) dan efisiensi biaya yang baik.
- **Gemini 2.5 Flash (Fallback)**: Digunakan jika Groq terkena rate limit (HTTP 429) atau server error (HTTP 5xx). Menggunakan pemanggilan direct API melalui HTTP request (`axios`) agar menghindari dependency package tambahan jika terjadi crash.

---

## 🤖 2. Agentic System (Vercel AI SDK + MCP)
Digunakan ketika agen AI membutuhkan koordinasi dengan MCP Server (`FlowLLM-Finance` atau `Aitrados`) untuk melakukan query data pasar keuangan.

### Resolusi Model & Prioritas Gateway:
Ketika request masuk ke sistem agen, model AI dipilih secara dinamis menggunakan urutan prioritas berikut:

| Prioritas | Provider/Gateway | Model Default | Trigger Kondisi | Peran |
| :--- | :--- | :--- | :--- | :--- |
| **1** | **9Router** | `openai/gpt-4o` | `NINE_ROUTER_URL` aktif | Ultimate Proxy / Load Balancer otomatis untuk menembus rate limits. |
| **2** | **OpenRouter / Anthropic** | `claude-3-opus-20240229` | `ANTHROPIC_AUTH_TOKEN` ada | Model reasoning tingkat tinggi untuk logika analisis rumit. |
| **3** | **Google Gemini** | `gemini-2.5-flash` | `GEMINI_API_KEY` ada | Model cepat & ekonomis dengan support function calling yang solid. |
| **4** | **Groq** | `llama-3.3-70b-versatile` | `GROQ_API_KEY` ada | Pilihan alternatif gratis/murah dengan latensi rendah. |
| **5** | **OpenRouter Free** | `openai/gpt-oss-120b:free` | Fallback Akhir | Menjamin sistem tetap menyala meskipun seluruh API key di atas bermasalah atau habis kuota. |

---

## ⚙️ Konfigurasi Environment Variables
Semua kunci konfigurasi dapat diatur di file `.env` (lihat `.env.example` untuk panduan):

```bash
# API Keys
GEMINI_API_KEY=your-gemini-key
ANTHROPIC_AUTH_TOKEN=your-openrouter-or-anthropic-token
GROQ_API_KEY=your-groq-key

# Pilihan Model (Optional Overrides)
GEMINI_MODEL=gemini-2.5-flash
ANTHROPIC_MODEL=anthropic/claude-3-5-haiku-latest
GROQ_MODEL=llama-3.3-70b-versatile

# 9Router Config (Optional)
NINE_ROUTER_URL=https://api.9router.com/v1
NINE_ROUTER_API_KEY=your-9router-key
```

---

## 💰 Rekomendasi Optimasi Biaya
1. **Pengembangan Lokal (Development)**:
   - Gunakan **Gemini 2.5 Flash** atau **Groq** sebagai driver utama karena biayanya sangat murah (atau gratis).
   - Jangan menyalakan `NINE_ROUTER_URL` di lokal kecuali sedang melakukan debugging load-balancing.
2. **Skala Produksi (Production)**:
   - Hubungkan backend ke **9Router** jika aplikasi diakses oleh banyak user komunitas secara simultan. 9Router secara cerdas mendistribusikan request untuk mencegah error batas kuota (Rate Limit Exceeded).
   - Gunakan **Claude 3.5 Haiku** melalui `ANTHROPIC_MODEL` sebagai jalan tengah terbaik antara biaya dan kecerdasan analisis makro.
