import 'package:flutter/material.dart';

/// Terminal Noir design tokens.
///
/// Single source of truth for colour, type and spacing on mobile.
/// Mirrors the web tokens in `web/login.html` so both surfaces keep the
/// same *feel* even though the implementations differ.
class TerminalNoir {
  TerminalNoir._();

  // ── Surfaces ────────────────────────────────────────────────
  static const Color voidBg = Color(0xFF020202);
  static const Color surface = Color(0xFF111116);
  static const Color elevated = Color(0xFF151520);
  static const Color input = Color(0xFF0A0A10);

  // ── Accent ──────────────────────────────────────────────────
  static const Color gold = Color(0xFFD4AF37);
  static const Color goldDim = Color(0xFF8B7722);
  static const Color goldGlow = Color(0x26D4AF37);

  // ── Signal ──────────────────────────────────────────────────
  static const Color neonGreen = Color(0xFF39FF88);
  static const Color neonOrange = Color(0xFFFF6A00);
  static const Color neonRed = Color(0xFFFF3864);

  // ── Text ────────────────────────────────────────────────────
  static const Color textPrimary = Color(0xFFE5E7EB);
  static const Color textSecondary = Color(0xFFCBD5E1);
  static const Color textMuted = Color(0xFF94A3B8);

  // ── Hairlines ───────────────────────────────────────────────
  static const Color hairline = Color(0x0DFFFFFF);
  static const Color hairlineStrong = Color(0x1AFFFFFF);

  // ── Spacing scale (8pt) ─────────────────────────────────────
  static const double s1 = 4;
  static const double s2 = 8;
  static const double s3 = 12;
  static const double s4 = 16;
  static const double s5 = 20;
  static const double s6 = 24;
  static const double s8 = 32;

  // ── Radii ───────────────────────────────────────────────────
  static const double rSm = 4;
  static const double rMd = 8;
  static const double rLg = 12;

  /// Mono face for anything machine-ish: labels, values, status.
  static const String monoFamily = 'JetBrainsMono';

  /// Sans face for prose.
  static const String sansFamily = 'Inter';

  static ThemeData theme() {
    final base = ThemeData.dark(useMaterial3: true);
    return base.copyWith(
      scaffoldBackgroundColor: voidBg,
      colorScheme: base.colorScheme.copyWith(
        surface: surface,
        primary: gold,
        secondary: neonGreen,
        error: neonRed,
        onPrimary: voidBg,
        onSurface: textPrimary,
      ),
      textTheme: base.textTheme.apply(
        bodyColor: textPrimary,
        displayColor: textPrimary,
        fontFamily: sansFamily,
      ),
      inputDecorationTheme: InputDecorationTheme(
        filled: true,
        fillColor: input,
        contentPadding: const EdgeInsets.symmetric(
          horizontal: s3,
          vertical: s3,
        ),
        hintStyle: const TextStyle(
          color: Color(0x6694A3B8),
          fontFamily: monoFamily,
          fontSize: 13,
        ),
        enabledBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(rSm),
          borderSide: const BorderSide(color: hairlineStrong),
        ),
        focusedBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(rSm),
          borderSide: const BorderSide(color: gold),
        ),
        errorBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(rSm),
          borderSide: const BorderSide(color: neonRed),
        ),
        focusedErrorBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(rSm),
          borderSide: const BorderSide(color: neonRed),
        ),
      ),
      pageTransitionsTheme: const PageTransitionsTheme(
        builders: {
          TargetPlatform.android: FadeUpwardsPageTransitionsBuilder(),
          TargetPlatform.iOS: CupertinoPageTransitionsBuilder(),
        },
      ),
    );
  }
}
