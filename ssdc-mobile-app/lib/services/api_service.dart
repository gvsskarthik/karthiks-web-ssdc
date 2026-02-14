import 'dart:convert';
import 'package:http/http.dart' as http;
import 'package:shared_preferences/shared_preferences.dart';

class ApiService {
  // ⚠️ REPLACE WITH YOUR SERVER IP (e.g., 192.168.1.x or VPS IP)
  // Localhost (10.0.2.2) works for Android Emulator
  static const String baseUrl = "http://10.0.2.2:8080/api/patient-app";

  static Future<Map<String, dynamic>> login(String mobile, String password) async {
    try {
      final response = await http.post(
        Uri.parse('$baseUrl/login'),
        headers: {'Content-Type': 'application/json'},
        body: jsonEncode({'mobile': mobile, 'password': password}),
      );

      if (response.statusCode == 200) {
        return jsonDecode(response.body);
      } else {
        throw Exception('Login failed: ${response.statusCode}');
      }
    } catch (e) {
      throw Exception('Connection error: $e');
    }
  }

  static Future<List<dynamic>> getVisits() async {
    final prefs = await SharedPreferences.getInstance();
    final mobile = prefs.getString('ssdc_mobile');
    if (mobile == null) throw Exception("Not logged in");

    final response = await http.get(
      Uri.parse('$baseUrl/visits?mobile=$mobile'),
    );

    if (response.statusCode == 200) {
      return jsonDecode(response.body);
    } else {
      throw Exception('Failed to load visits');
    }
  }
}
