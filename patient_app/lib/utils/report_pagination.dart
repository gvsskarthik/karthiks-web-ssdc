import '../models/report_item.dart';

/// Each A4 page can contain at most this many "boxes" (table body rows).
/// A data row consumes `max(1, normalRangeLineCount)` boxes.
const int kReportBoxesPerPage = 29;

enum ReportBoxRowKind {
  testHeader,
  data,
  normalOnly,
}

class ReportBoxRow {
  final ReportBoxRowKind kind;
  final String testName;
  final String testOrParameter;
  final String result;
  final String unit;
  final String normal;
  final bool indentTestOrParameter;
  final bool abnormalResult;

  const ReportBoxRow._({
    required this.kind,
    required this.testName,
    required this.testOrParameter,
    required this.result,
    required this.unit,
    required this.normal,
    required this.indentTestOrParameter,
    required this.abnormalResult,
  });

  const ReportBoxRow.testHeader(String testName)
      : this._(
          kind: ReportBoxRowKind.testHeader,
          testName: testName,
          testOrParameter: testName,
          result: '',
          unit: '',
          normal: '',
          indentTestOrParameter: false,
          abnormalResult: false,
        );

  const ReportBoxRow.data({
    required String testName,
    required String testOrParameter,
    required String result,
    required String unit,
    required String normal,
    required bool indentTestOrParameter,
    required bool abnormalResult,
  }) : this._(
          kind: ReportBoxRowKind.data,
          testName: testName,
          testOrParameter: testOrParameter,
          result: result,
          unit: unit,
          normal: normal,
          indentTestOrParameter: indentTestOrParameter,
          abnormalResult: abnormalResult,
        );

  const ReportBoxRow.normalOnly({
    required String testName,
    required String normal,
  }) : this._(
          kind: ReportBoxRowKind.normalOnly,
          testName: testName,
          testOrParameter: '',
          result: '',
          unit: '',
          normal: normal,
          indentTestOrParameter: false,
          abnormalResult: false,
        );
}

class ReportPage {
  final List<ReportBoxRow> rows;
  const ReportPage(this.rows);
}

class ReportPagination {
  static List<ReportPage> paginate(
    List<ReportItem> items, {
    int boxesPerPage = kReportBoxesPerPage,
  }) {
    if (items.isEmpty) return const <ReportPage>[];

    final groups = _stableGroups(items);
    final pages = <ReportPage>[];

    var currentRows = <ReportBoxRow>[];
    var remaining = boxesPerPage;

    void pushPage() {
      if (currentRows.isEmpty) return;
      pages.add(ReportPage(List<ReportBoxRow>.unmodifiable(currentRows)));
      currentRows = <ReportBoxRow>[];
      remaining = boxesPerPage;
    }

    void ensureNewPageIfNeeded(int neededBoxes) {
      if (neededBoxes <= remaining) return;
      pushPage();
    }

    for (final group in groups) {
      final testName = group.testName;
      final showHeader = _shouldShowTestHeader(group.items);
      final headerBox = showHeader ? 1 : 0;

      final groupItems = showHeader
          ? group.items.where((i) => !_isRedundantGroupRow(i)).toList(growable: false)
          : group.items;
      if (groupItems.isEmpty) continue;

      final blocks = groupItems
          .map((item) => _itemBlock(item, grouped: showHeader))
          .toList(growable: false);

      final groupBoxes =
          headerBox + blocks.fold<int>(0, (sum, b) => sum + b.boxes);

      if (groupBoxes <= remaining) {
        if (showHeader) {
          currentRows.add(ReportBoxRow.testHeader(testName));
          remaining -= 1;
        }
        for (final b in blocks) {
          currentRows.addAll(b.rows);
          remaining -= b.boxes;
        }
        continue;
      }

      if (groupBoxes <= boxesPerPage) {
        ensureNewPageIfNeeded(groupBoxes);
        if (showHeader) {
          currentRows.add(ReportBoxRow.testHeader(testName));
          remaining -= 1;
        }
        for (final b in blocks) {
          currentRows.addAll(b.rows);
          remaining -= b.boxes;
        }
        continue;
      }

      // Group is larger than one page: split across pages and repeat header.
      if (currentRows.isNotEmpty) pushPage();

      for (final b in blocks) {
        // Never start a logical block if it doesn't fit the remaining boxes.
        // If the block itself is larger than a page, it will be split, but we
        // still start it on a fresh page to keep page breaks deterministic.
        if (b.boxes > remaining && currentRows.isNotEmpty) {
          pushPage();
        }

        // Start a new page segment for this test group when needed.
        if (currentRows.isEmpty && showHeader) {
          currentRows.add(ReportBoxRow.testHeader(testName));
          remaining -= 1;
        }

        if (b.boxes <= remaining) {
          currentRows.addAll(b.rows);
          remaining -= b.boxes;
          continue;
        }

        // Block itself cannot fit on a fresh page: split by box rows.
        var idx = 0;
        while (idx < b.rows.length) {
          if (remaining == 0) {
            pushPage();
          }

          if (currentRows.isEmpty && showHeader) {
            currentRows.add(ReportBoxRow.testHeader(testName));
            remaining -= 1;
          }

          final take = (b.rows.length - idx).clamp(0, remaining);
          if (take == 0) {
            pushPage();
            continue;
          }

          currentRows.addAll(b.rows.sublist(idx, idx + take));
          idx += take;
          remaining -= take;
        }
      }
    }

    pushPage();
    return List<ReportPage>.unmodifiable(pages);
  }

  static bool _shouldShowTestHeader(List<ReportItem> group) {
    if (group.isEmpty) return false;
    if (group.length > 1) return true;

    final item = group.first;
    final param = item.parameterName.trim();
    if (param.isEmpty) return false;

    return param.toLowerCase() != item.testName.trim().toLowerCase();
  }

  static List<_TestGroup> _stableGroups(List<ReportItem> items) {
    // Stable by first occurrence, while keeping each testId together.
    // IMPORTANT: Do NOT sort by any field here; backend order is the source of
    // truth for report priority.
    final map = <int, _TestGroup>{};

    for (final item in items) {
      final existing = map[item.testId];
      if (existing != null) {
        existing.items.add(item);
        continue;
      }

      map[item.testId] = _TestGroup(
        testId: item.testId,
        testName: item.testName,
        items: <ReportItem>[item],
      );
    }

    return List<_TestGroup>.unmodifiable(map.values);
  }

  static _ItemBlock _itemBlock(ReportItem item, {required bool grouped}) {
    final normalLines = _splitNormalLines(item.normalRange);
    final boxes = normalLines.isEmpty ? 1 : normalLines.length;

    final param = item.parameterName.trim();
    final label = grouped
        ? (_isMeaningfulParameter(item) ? param : '')
        : (param.isNotEmpty ? param : item.testName.trim());
    final indent = grouped && _isMeaningfulParameter(item);

    final rows = <ReportBoxRow>[];
    rows.add(
      ReportBoxRow.data(
        testName: item.testName,
        testOrParameter: label,
        result: item.resultValue ?? '',
        unit: item.unit ?? '',
        normal: normalLines.isNotEmpty ? normalLines.first : '',
        indentTestOrParameter: indent,
        abnormalResult: item.isAbnormal,
      ),
    );

    for (final line in normalLines.skip(1)) {
      rows.add(ReportBoxRow.normalOnly(testName: item.testName, normal: line));
    }

    return _ItemBlock(boxes: boxes, rows: List<ReportBoxRow>.unmodifiable(rows));
  }

  static List<String> _splitNormalLines(String? raw) {
    if (raw == null || raw.trim().isEmpty) return const <String>[];
    return raw
        .split('\n')
        .map((e) => e.trim())
        .where((e) => e.isNotEmpty)
        .toList(growable: false);
  }

  static bool _isMeaningfulParameter(ReportItem item) {
    final param = item.parameterName.trim();
    if (param.isEmpty) return false;
    return param.toLowerCase() != item.testName.trim().toLowerCase();
  }

  static bool _hasAnyValue(ReportItem item) {
    final result = item.resultValue?.trim() ?? '';
    final unit = item.unit?.trim() ?? '';
    final range = item.normalRange?.trim() ?? '';
    return result.isNotEmpty || unit.isNotEmpty || range.isNotEmpty;
  }

  static bool _isRedundantGroupRow(ReportItem item) {
    final param = item.parameterName.trim();
    final nonMeaningfulParam =
        param.isEmpty || param.toLowerCase() == item.testName.trim().toLowerCase();
    return nonMeaningfulParam && !_hasAnyValue(item);
  }
}

class _TestGroup {
  final int testId;
  final String testName;
  final List<ReportItem> items;
  _TestGroup({
    required this.testId,
    required this.testName,
    required this.items,
  });
}

class _ItemBlock {
  final int boxes;
  final List<ReportBoxRow> rows;
  _ItemBlock({required this.boxes, required this.rows});
}
