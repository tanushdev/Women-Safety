import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';

class AppColors {
  // 💎 Brand Primary — Vibrant Apple / Spotify-grade Magenta Pink
  static const Color primary = Color(0xFFFF2D78); 
  static const Color primaryDark = Color(0xFFD8145C);
  static const Color primaryLight = Color(0xFFFFF0F5);
  static const Color primaryGradientStart = Color(0xFFFF337F);
  static const Color primaryGradientEnd = Color(0xFFE11D48);

  // Accent Tones
  static const Color accent = Color(0xFFFF528C);
  static const Color accentSoft = Color(0xFFFFF1F6);

  // Semantic Colors
  static const Color danger = Color(0xFFEF4444);
  static const Color dangerBg = Color(0xFFFEF2F2);
  static const Color safe = Color(0xFF10B981);
  static const Color safeBg = Color(0xFFECFDF5);
  static const Color warning = Color(0xFFF59E0B);
  static const Color warningBg = Color(0xFFFFFBEB);
  static const Color info = Color(0xFF6366F1);
  static const Color infoBg = Color(0xFFEEF2FF);

  // SOS Pulses
  static const Color sosActive = Color(0xFFFF2D78);
  static const Color sosPulse = Color(0xFFFF6495);

  // 💎 Background & Surfaces — Pristine, Clean Ceramic White & Subtle Tint
  static const Color background = Color(0xFFF8FAFC); // Clean ceramic white-gray
  static const Color surface = Color(0xFFFFFFFF);
  static const Color surfaceElevated = Color(0xFFFFFFFF);
  static const Color surfaceDark = Color(0xFF18191E);

  // Typography Tones
  static const Color textPrimary = Color(0xFF0F172A); // Rich dark slate
  static const Color textSecondary = Color(0xFF64748B); // Slate 500
  static const Color textMuted = Color(0xFF94A3B8); // Slate 400
  static const Color textHint = Color(0xFFCBD5E1);

  // Borders & Dividers
  static const Color borderLight = Color(0xFFF1F5F9);
  static const Color borderSubtle = Color(0xFFE2E8F0);

  // Status Colors
  static const Color success = Color(0xFF10B981);
  static const Color error = Color(0xFFEF4444);
  static const Color disabled = Color(0xFFE2E8F0);

  // Overlays
  static const Color overlay = Color(0x73000000);
  static const Color shimmer = Color(0xFFF1F5F9);
}

class AppTheme {
  static ThemeData get lightTheme {
    final baseFont = GoogleFonts.plusJakartaSans();

    return ThemeData(
      useMaterial3: true,
      colorScheme: ColorScheme.fromSeed(
        seedColor: AppColors.primary,
        primary: AppColors.primary,
        secondary: AppColors.accent,
        error: AppColors.error,
        surface: AppColors.surface,
      ),
      scaffoldBackgroundColor: AppColors.background,

      // App Bar Theme — Borderless, pristine white with subtle backdrop
      appBarTheme: AppBarTheme(
        backgroundColor: Colors.white,
        foregroundColor: AppColors.textPrimary,
        elevation: 0,
        scrolledUnderElevation: 0,
        centerTitle: true,
        titleTextStyle: GoogleFonts.plusJakartaSans(
          color: AppColors.textPrimary,
          fontSize: 18,
          fontWeight: FontWeight.w700,
          letterSpacing: -0.3,
        ),
      ),

      // Bottom Navigation Bar Theme
      bottomNavigationBarTheme: BottomNavigationBarThemeData(
        backgroundColor: Colors.white,
        selectedItemColor: AppColors.primary,
        unselectedItemColor: AppColors.textSecondary,
        type: BottomNavigationBarType.fixed,
        elevation: 0,
        selectedLabelStyle: GoogleFonts.plusJakartaSans(
          fontSize: 12,
          fontWeight: FontWeight.w700,
        ),
        unselectedLabelStyle: GoogleFonts.plusJakartaSans(
          fontSize: 12,
          fontWeight: FontWeight.w500,
        ),
      ),

      // Card Theme — Apple/Airbnb 24px rounded ceramic cards
      cardTheme: CardThemeData(
        elevation: 0,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(24),
          side: const BorderSide(color: Color(0xFFF1F5F9), width: 1.2),
        ),
        color: AppColors.surface,
        shadowColor: Colors.black.withValues(alpha: 0.03),
      ),

      // Elevated Button Theme — Pill shape with gradient or solid
      elevatedButtonTheme: ElevatedButtonThemeData(
        style: ElevatedButton.styleFrom(
          backgroundColor: AppColors.primary,
          foregroundColor: Colors.white,
          elevation: 0,
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(28),
          ),
          padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 15),
          textStyle: GoogleFonts.plusJakartaSans(
            fontSize: 15,
            fontWeight: FontWeight.w700,
            letterSpacing: -0.2,
          ),
        ),
      ),

      // Input Decoration Theme — Soft pill inputs
      inputDecorationTheme: InputDecorationTheme(
        filled: true,
        fillColor: Colors.white,
        contentPadding: const EdgeInsets.symmetric(horizontal: 20, vertical: 16),
        border: OutlineInputBorder(
          borderRadius: BorderRadius.circular(24),
          borderSide: const BorderSide(color: Color(0xFFE2E8F0), width: 1.2),
        ),
        enabledBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(24),
          borderSide: const BorderSide(color: Color(0xFFE2E8F0), width: 1.2),
        ),
        focusedBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(24),
          borderSide: const BorderSide(color: AppColors.primary, width: 1.8),
        ),
        hintStyle: GoogleFonts.plusJakartaSans(
          color: AppColors.textMuted,
          fontSize: 14,
          fontWeight: FontWeight.w500,
        ),
      ),

      textTheme: GoogleFonts.plusJakartaSansTextTheme(),
    );
  }

  static ThemeData get darkTheme => lightTheme;
}
