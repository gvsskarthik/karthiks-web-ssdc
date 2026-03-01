import 'dart:convert';
import 'package:http/http.dart' as http;
import '../models/patient.dart';
import '../models/report_item.dart';

class ApiService {
  static const String _base = 'https://ssdclabs.online/api';

  static Future<Map<String, dynamic>> login(String mobile, String password) async {
    try {
      final res = await http.post(
        Uri.parse('$_base/patient-app/login'),
        headers: {'Content-Type': 'application/json'},
        body: jsonEncode({'mobile': mobile, 'password': password}),
      ).timeout(const Duration(seconds: 15));

      if (res.statusCode == 200) return jsonDecode(res.body) as Map<String, dynamic>;
      if (res.statusCode == 401) throw 'Invalid mobile or password.';
      throw 'Server error (${res.statusCode}). Please try again.';
    } catch (e) {
      if (e is String) rethrow;
      throw 'Cannot connect to server. Check your internet.';
    }
  }

  static Future<List<Patient>> getVisits(String mobile, String password) async {
    try {
      final res = await http.get(
        Uri.parse('$_base/patient-app/visits'
            '?mobile=${Uri.encodeComponent(mobile)}'
            '&password=${Uri.encodeComponent(password)}'),
      ).timeout(const Duration(seconds: 15));

      if (res.statusCode == 200) {
        final List list = jsonDecode(res.body) as List;
        return list.map((e) => Patient.fromJson(e as Map<String, dynamic>)).toList();
      }
      if (res.statusCode == 401) throw 'Session expired. Please log in again.';
      throw 'Failed to load patient list.';
    } catch (e) {
      if (e is String) rethrow;
      throw 'Cannot connect to server. Check your internet.';
    }
  }

  static Future<List<ReportItem>> getReport(int patientId, String mobile) async {
    try {
      final res = await http.get(
        Uri.parse('$_base/patient-app/report/$patientId?mobile=${Uri.encodeComponent(mobile)}'),
      ).timeout(const Duration(seconds: 15));

      if (res.statusCode == 200) {
        final List list = jsonDecode(res.body) as List;
        return list.map((e) => ReportItem.fromJson(e as Map<String, dynamic>)).toList();
      }
      if (res.statusCode == 401) throw 'Access denied. Please log in again.';
      if (res.statusCode == 404) throw 'Report not found.';
      throw 'Failed to load report.';
    } catch (e) {
      if (e is String) rethrow;
      throw 'Cannot connect to server. Check your internet.';
    }
  }

  static Future<void> changePassword(
      String mobile, String oldPassword, String newPassword) async {
    try {
      final res = await http.post(
        Uri.parse('$_base/patient-app/change-password'),
        headers: {'Content-Type': 'application/json'},
        body: jsonEncode({
          'mobile': mobile,
          'oldPassword': oldPassword,
          'newPassword': newPassword,
        }),
      ).timeout(const Duration(seconds: 15));

      if (res.statusCode == 200) return;
      if (res.statusCode == 401) throw 'Incorrect current password.';
      throw 'Server error (${res.statusCode}).';
    } catch (e) {
      if (e is String) rethrow;
      throw 'Cannot connect to server. Check your internet.';
    }
  }
}
