/**
 * PRICING SSOT — satu-satunya sumber kebenaran harga & prefix order_id pembayaran.
 *
 * Aturan: harga TIDAK BOLEH dihitung di klien (frontend) maupun di gateway Midtrans
 * berdasarkan input klien. Controller memvalidasi `amountIDR` terhadap tabel ini,
 * dan Midtrans service menerima nominal final saja.
 *
 * Pembaruan harga = ubah file ini + rebuild server. Tidak perlu menyentuh frontend.
 */

/** Prefix kanonik order_id Midtrans. Dipakai controller + parseOrderId. */
export const ORDER_PREFIX = {
  registration: "reg",
  package: "pkg",
} as const;

/**
 * Prefix legacy yang pernah dipakai produksi. Tetap diterima `parseOrderId`
 * supaya transaksi lama (dan order_id yang sudah tercetak di Midtrans) tidak
 * ditolak saat callback/webhook tiba.
 */
export const ORDER_PREFIX_LEGACY = {
  registration: ["reg", "registration"],
  package: ["pkg", "package"],
} as const;

export type PackageType = "basic" | "pro" | "premium";
export type OrderType = "registration" | "package";

interface PackagePrice {
  amountIDR: number;
  durationMs: number | null; // null = lifetime
  label: string;
}

/**
 * Tabel harga. Nilai di sini yang dipakai server; frontend hanya menampilkan
 * apa yang dikembalikan endpoint `GET /api/v1/payment/prices`.
 */
export const PRICING = {
  /** Registrasi komunitas: akses awal. */
  registration: {
    amountIDR: 150_000,
    durationMs: 30 * 24 * 60 * 60 * 1000, // 30 hari
    label: "Registration & AI Trading Access",
  } satisfies PackagePrice,

  /** Paket AI Trading (bukan langganan token). */
  packages: {
    basic: {
      amountIDR: 1_500_000,
      durationMs: 90 * 24 * 60 * 60 * 1000, // 3 bulan
      label: "AI Trading Package - BASIC",
    },
    pro: {
      amountIDR: 2_500_000,
      durationMs: 180 * 24 * 60 * 60 * 1000, // 6 bulan
      label: "AI Trading Package - PRO",
    },
    premium: {
      amountIDR: 3_500_000,
      durationMs: null, // lifetime
      label: "AI Trading Package - PREMIUM",
    },
  } satisfies Record<PackageType, PackagePrice>,

  /** Diskon booster: dipotong SEKALI di server (bukan di klien). */
  boosterDiscountRate: 0.1,
} as const;

/**
 * Harga final untuk sebuah order — SATU titik perhitungan diskon di server.
 * `amountIDR` yang dikirim Midtrans = nilai ini.
 */
export function getAmountIDR(params: {
  orderType: OrderType;
  packageType?: PackageType;
  isBooster: boolean;
}): number {
  const { orderType, packageType, isBooster } = params;

  let base: number;
  if (orderType === "registration") base = PRICING.registration.amountIDR;
  else if (orderType === "package") {
    if (!packageType) {
      throw new Error("packageType is required for orderType 'package'");
    }
    base = PRICING.packages[packageType].amountIDR;
  } else {
    throw new Error(`Unknown orderType: ${String(orderType)}`);
  }

  if (!Number.isFinite(base) || base <= 0) {
    throw new Error(`Invalid base price for ${orderType}/${String(packageType)}`);
  }

  // Diskon booster hanya berlaku untuk pembelian paket (bukan registrasi/topup).
  if (isBooster && orderType === "package") {
    return Math.round(base * (1 - PRICING.boosterDiscountRate));
  }
  return base;
}

/**
 * Validasi `amountIDR` dari klien terhadap tabel harga.
 * Mengembalikan `{ ok: true, amountIDR }` atau `{ ok: false, error }`.
 */
export function validateAmountIDR(params: {
  orderType: OrderType;
  packageType?: PackageType;
  amountIDR: unknown;
  isBooster: boolean;
}): { ok: true; amountIDR: number } | { ok: false; error: string } {
  const { orderType, packageType, amountIDR, isBooster } = params;

  if (typeof amountIDR !== "number" || !Number.isFinite(amountIDR)) {
    return { ok: false, error: "amountIDR must be a finite number" };
  }
  if (!Number.isInteger(amountIDR) || amountIDR <= 0) {
    return { ok: false, error: "amountIDR must be a positive integer" };
  }

  let expected: number;
  try {
    expected = getAmountIDR({ orderType, packageType, isBooster });
  } catch (e: any) {
    return { ok: false, error: e.message };
  }

  if (amountIDR !== expected) {
    return {
      ok: false,
      error: `amountIDR ${amountIDR} does not match the price table (${expected}) for ${orderType}/${String(packageType)}`,
    };
  }

  return { ok: true, amountIDR };
}

/** Bentuk payload yang dikembalikan `GET /api/v1/payment/prices`. */
export function getPricingCatalog(isBooster: boolean) {
  const pkg = (p: PackageType) => ({
    type: p,
    amountIDR: getAmountIDR({ orderType: "package", packageType: p, isBooster }),
    baseAmountIDR: PRICING.packages[p].amountIDR,
    durationMs: PRICING.packages[p].durationMs,
    label: PRICING.packages[p].label,
  });

  return {
    currency: "IDR",
    boosterDiscountRate: PRICING.boosterDiscountRate,
    boosterAppliesTo: ["package"],
    registration: {
      ...PRICING.registration,
      amountIDR: getAmountIDR({ orderType: "registration", isBooster }),
    },
    packages: {
      basic: pkg("basic"),
      pro: pkg("pro"),
      premium: pkg("premium"),
    },
  };
}
