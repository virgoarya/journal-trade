# Skill: Frontend UI Engineering

> Panduan membangun komponen React/Next.js yang premium untuk project Hunter Trades Journal.
> Baca ini sebelum membuat atau memodifikasi komponen UI apapun.

---

## Design System: Terminal Noir

### Color Palette
```css
/* Backgrounds */
--bg-primary: #0A0A0F;
--bg-secondary: #121218;
--bg-panel: #1A1A24;
--bg-card: #1E1E2E;
--bg-hover: #252535;

/* Accents */
--gold: #D4AF37;
--gold-hover: #B5952F;
--gold-dim: #D4AF3722;

/* Text */
--text-primary: #E8E8F0;
--text-secondary: #888898;
--text-muted: #555566;

/* Status */
--color-profit: #00D4AA;
--color-loss: #FF4466;
--color-warning: #FFB830;
```

### Typography
```css
/* Gunakan dari Google Fonts */
font-family: 'Inter', 'Roboto', sans-serif;

/* Monospace untuk data trading/harga */
font-family: 'JetBrains Mono', 'Courier New', monospace;
```

---

## Komponen Standards

### 1. Card / Panel
```tsx
// Selalu gunakan gold border atau glow pada elemen penting
<div className="bg-[#1E1E2E] border border-[#D4AF3733] rounded-xl p-4
               hover:border-[#D4AF37] transition-all duration-300">
```

### 2. Status Badge
```tsx
// Profit/Loss badge
<span className={`px-2 py-0.5 rounded text-xs font-mono font-bold
  ${isProfit ? 'text-[#00D4AA] bg-[#00D4AA15]' : 'text-[#FF4466] bg-[#FF446615]'}`}>
  {value}
</span>
```

### 3. Micro-Animations
```css
/* Hover lift effect */
.card:hover { transform: translateY(-2px); box-shadow: 0 8px 32px rgba(212,175,55,0.15); }

/* Glow pulse untuk data realtime */
@keyframes glow-pulse {
  0%, 100% { box-shadow: 0 0 4px rgba(212,175,55,0.3); }
  50% { box-shadow: 0 0 12px rgba(212,175,55,0.6); }
}
```

---

## Aturan Komponen

1. **Jangan gunakan warna generic** (merah, biru, hijau polos). Gunakan palet di atas.
2. **Semua komponen harus responsive** — cek tampilan di mobile (375px) dan desktop (1280px+).
3. **Loading state wajib ada** — Gunakan skeleton loading, bukan spinner generik.
4. **Error state wajib ada** — Tampilkan pesan error yang informatif, bukan hanya kode error.
5. **Data angka/harga** harus menggunakan monospace font agar sejajar dengan baik.

---

## Lightweight Charts Integration

- Selalu gunakan `ColorType.Solid` untuk background chart agar sesuai dengan tema gelap.
- Warna candle: `upColor: '#00D4AA'`, `downColor: '#FF4466'`
- Grid color: `'rgba(212,175,55,0.08)'`
- Gunakan `autoSize: true` agar chart responsive.
