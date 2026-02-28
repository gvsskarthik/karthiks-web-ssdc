class ReportItem {
  final int testId;
  final String testName;
  final String parameterName;
  final String? resultValue;
  final String? unit;
  final String? normalRange;
  final int? reportPriority;

  ReportItem({
    required this.testId,
    required this.testName,
    required this.parameterName,
    this.resultValue,
    this.unit,
    this.normalRange,
    this.reportPriority,
  });

  factory ReportItem.fromJson(Map<String, dynamic> json) {
    final testIdRaw = json['testId'];
    final testId = switch (testIdRaw) {
      int v => v,
      num v => v.toInt(),
      String v => int.tryParse(v) ?? double.tryParse(v)?.toInt() ?? -1,
      _ => -1,
    };

    int? intOrNull(dynamic v) {
      if (v == null) return null;
      if (v is int) return v;
      if (v is num) return v.toInt();
      if (v is String) {
        final asInt = int.tryParse(v);
        if (asInt != null) return asInt;
        final asDouble = double.tryParse(v);
        if (asDouble != null) return asDouble.toInt();
      }
      return null;
    }

    String? stringOrNull(dynamic v) {
      if (v == null) return null;
      final s = v.toString();
      return s.isEmpty ? null : s;
    }

    return ReportItem(
      testId: testId,
      testName: (json['testName'] ?? '').toString(),
      parameterName: (json['parameterName'] ?? '').toString(),
      resultValue: stringOrNull(json['resultValue']),
      unit: stringOrNull(json['unit']),
      normalRange: stringOrNull(json['normalRange']),
      reportPriority: intOrNull(
        json['reportPriority'] ??
            json['report_priority'] ??
            json['testPriority'] ??
            json['test_priority'] ??
            json['priority'] ??
            json['reportOrder'] ??
            json['report_order'] ??
            json['sortOrder'] ??
            json['sort_order'] ??
            json['order'],
      ),
    );
  }

  /// Returns true if resultValue is outside normalRange.
  /// Handles: "12.0-17.0", "< 200", "> 4.5", "70 - 110"
  bool get isAbnormal {
    final resultRaw = resultValue?.trim() ?? '';
    final rangeRaw = normalRange?.trim() ?? '';
    if (resultRaw.isEmpty || rangeRaw.isEmpty) {
      return false;
    }

    double? firstNumber(String s) {
      final m = RegExp(r'[-+]?\d*\.?\d+').firstMatch(s);
      if (m == null) return null;
      return double.tryParse(m.group(0)!);
    }

    List<double> allNumbers(String s) {
      return RegExp(r'[-+]?\d*\.?\d+')
          .allMatches(s)
          .map((m) => double.tryParse(m.group(0)!) ?? double.nan)
          .where((v) => !v.isNaN)
          .toList(growable: false);
    }

    final val = firstNumber(resultRaw);
    if (val == null) {
      final r = resultRaw.toLowerCase();
      final n = rangeRaw.toLowerCase();
      if (n.contains('negative') && r.contains('positive')) return true;
      if (n.contains('non reactive') && r.contains('reactive')) return true;
      return false;
    }

    final range = rangeRaw.replaceAll('–', '-').trimLeft();

    if (range.startsWith('<') || range.startsWith('≤')) {
      final limit = firstNumber(range);
      if (limit == null) return false;
      return range.startsWith('≤') ? val > limit : val >= limit;
    }

    if (range.startsWith('>') || range.startsWith('≥')) {
      final limit = firstNumber(range);
      if (limit == null) return false;
      return range.startsWith('≥') ? val < limit : val <= limit;
    }

    final nums = allNumbers(range);
    if (nums.length >= 2) {
      final low = nums[0];
      final high = nums[1];
      return val < low || val > high;
    }

    return false;
  }
}
