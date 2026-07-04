import 'package:flutter/material.dart';

/// Dark palette mirroring the web app's "pixel" theme tokens.
abstract final class AppColors {
  static const bg = Color(0xFF0B0820);
  static const bg2 = Color(0xFF14102E);
  static const panel = Color(0xFF191339);
  static const panelBorder = Color(0xFF2E2560);
  static const text = Color(0xFFE8E4F5);
  static const muted = Color(0xFF8D86AD);
  static const accent = Color(0xFFF1D999);
  static const gold = Color(0xFFD9B66C);
  static const danger = Color(0xFFFF6B6B);
  static const success = Color(0xFF7DFF9B);
  static const ruling = Color(0xFF3B82F6);
  static const opposition = Color(0xFFEF4444);
}

ThemeData buildAppTheme() {
  const scheme = ColorScheme.dark(
    surface: AppColors.bg,
    primary: AppColors.accent,
    secondary: AppColors.gold,
    error: AppColors.danger,
    onSurface: AppColors.text,
    onPrimary: Color(0xFF1A1233),
  );

  return ThemeData(
    useMaterial3: true,
    colorScheme: scheme,
    scaffoldBackgroundColor: AppColors.bg,
    appBarTheme: const AppBarTheme(
      backgroundColor: AppColors.bg,
      foregroundColor: AppColors.accent,
      elevation: 0,
      centerTitle: false,
    ),
    cardTheme: const CardThemeData(
      color: AppColors.panel,
      shape: RoundedRectangleBorder(
        side: BorderSide(color: AppColors.panelBorder, width: 2),
        borderRadius: BorderRadius.all(Radius.circular(12)),
      ),
      elevation: 0,
      margin: EdgeInsets.zero,
    ),
    inputDecorationTheme: InputDecorationTheme(
      filled: true,
      fillColor: AppColors.bg2,
      labelStyle: const TextStyle(color: AppColors.muted),
      hintStyle: const TextStyle(color: AppColors.muted),
      enabledBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(10),
        borderSide: const BorderSide(color: AppColors.panelBorder, width: 2),
      ),
      focusedBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(10),
        borderSide: const BorderSide(color: AppColors.accent, width: 2),
      ),
      errorBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(10),
        borderSide: const BorderSide(color: AppColors.danger, width: 2),
      ),
      focusedErrorBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(10),
        borderSide: const BorderSide(color: AppColors.danger, width: 2),
      ),
    ),
    filledButtonTheme: FilledButtonThemeData(
      style: FilledButton.styleFrom(
        backgroundColor: AppColors.accent,
        foregroundColor: const Color(0xFF1A1233),
        textStyle: const TextStyle(fontWeight: FontWeight.w700),
        padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 14),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
      ),
    ),
    outlinedButtonTheme: OutlinedButtonThemeData(
      style: OutlinedButton.styleFrom(
        foregroundColor: AppColors.accent,
        side: const BorderSide(color: AppColors.gold, width: 2),
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
      ),
    ),
    textButtonTheme: TextButtonThemeData(
      style: TextButton.styleFrom(foregroundColor: AppColors.gold),
    ),
    snackBarTheme: const SnackBarThemeData(
      backgroundColor: AppColors.panel,
      contentTextStyle: TextStyle(color: AppColors.text),
      behavior: SnackBarBehavior.floating,
    ),
    dividerColor: AppColors.panelBorder,
  );
}
