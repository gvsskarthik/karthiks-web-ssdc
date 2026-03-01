import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import '../models/letterhead_lines.dart';

class StorageService {
  static const _storage = FlutterSecureStorage();
  static const _keyMobile = 'patient_mobile';
  static const _keyName = 'patient_name';
  static const _keyPassword = 'patient_password';
  static const _keyLetterheadTopLines = 'letterhead_top_lines';
  static const _keyLetterheadBottomLines = 'letterhead_bottom_lines';
  static const _keyLetterheadLeftLines = 'letterhead_left_lines';
  static const _keyLetterheadRightLines = 'letterhead_right_lines';

  static Future<void> saveSession({
    required String mobile,
    required String name,
    required String password,
  }) async {
    await _storage.write(key: _keyMobile, value: mobile);
    await _storage.write(key: _keyName, value: name);
    await _storage.write(key: _keyPassword, value: password);
  }

  static Future<String?> getMobile() async => await _storage.read(key: _keyMobile);
  static Future<String?> getName() async => await _storage.read(key: _keyName);
  static Future<String?> getPassword() async => await _storage.read(key: _keyPassword);

  static Future<void> saveLetterheadLines({
    required int top,
    required int bottom,
    required int left,
    required int right,
  }) async {
    await _storage.write(key: _keyLetterheadTopLines, value: top.toString());
    await _storage.write(
        key: _keyLetterheadBottomLines, value: bottom.toString());
    await _storage.write(key: _keyLetterheadLeftLines, value: left.toString());
    await _storage.write(
        key: _keyLetterheadRightLines, value: right.toString());
  }

  static Future<LetterheadLines> getLetterheadLines() async {
    Future<int> readInt(String key) async {
      final raw = await _storage.read(key: key);
      return int.tryParse(raw ?? '') ?? 0;
    }

    return LetterheadLines(
      top: await readInt(_keyLetterheadTopLines),
      bottom: await readInt(_keyLetterheadBottomLines),
      left: await readInt(_keyLetterheadLeftLines),
      right: await readInt(_keyLetterheadRightLines),
    );
  }

  static Future<void> clearSession() async {
    await _storage.delete(key: _keyMobile);
    await _storage.delete(key: _keyName);
    await _storage.delete(key: _keyPassword);
  }
}
