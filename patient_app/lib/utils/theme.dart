import 'package:flutter/material.dart';

class AppTheme {
  static const Color primary = Color(0xFF1565C0);
  static const Color primaryLight = Color(0xFF42A5F5);
  static const Color abnormal = Color(0xFFD32F2F);
  static const Color normal = Color(0xFF2E7D32);
  static const Color completed = Color(0xFF2E7D32);
  static const Color pending = Color(0xFFE65100);
  static const Color background = Color(0xFFF5F7FA);
  static const Color cardBg = Colors.white;
  static const Color textPrimary = Color(0xFF1A1A2E);
  static const Color textSecondary = Color(0xFF6B7280);

  static ThemeData get theme => ThemeData(
        colorScheme: ColorScheme.fromSeed(
          seedColor: primary,
          primary: primary,
          secondary: primaryLight,
        ),
        scaffoldBackgroundColor: background,
        appBarTheme: const AppBarTheme(
          backgroundColor: primary,
          foregroundColor: Colors.white,
          elevation: 0,
          centerTitle: false,
        ),
        cardTheme: CardThemeData(
          color: cardBg,
          elevation: 2,
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
        ),
        inputDecorationTheme: InputDecorationTheme(
          filled: true,
          fillColor: Colors.white,
          border: OutlineInputBorder(
            borderRadius: BorderRadius.circular(10),
            borderSide: const BorderSide(color: Color(0xFFDDE1E7)),
          ),
          enabledBorder: OutlineInputBorder(
            borderRadius: BorderRadius.circular(10),
            borderSide: const BorderSide(color: Color(0xFFDDE1E7)),
          ),
          focusedBorder: OutlineInputBorder(
            borderRadius: BorderRadius.circular(10),
            borderSide: const BorderSide(color: primary, width: 2),
          ),
          contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
        ),
        elevatedButtonTheme: ElevatedButtonThemeData(
          style: ElevatedButton.styleFrom(
            backgroundColor: primary,
            foregroundColor: Colors.white,
            minimumSize: const Size.fromHeight(50),
            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
            textStyle: const TextStyle(fontSize: 16, fontWeight: FontWeight.w600),
          ),
        ),
        useMaterial3: true,
      );
}
