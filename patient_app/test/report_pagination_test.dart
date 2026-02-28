import 'package:flutter_test/flutter_test.dart';
import 'package:patient_app/models/report_item.dart';
import 'package:patient_app/utils/report_pagination.dart';

ReportItem _item({
  required int testId,
  required String testName,
  String parameterName = '',
  String? resultValue,
  String? unit,
  String? normalRange,
  int? reportPriority,
}) {
  return ReportItem(
    testId: testId,
    testName: testName,
    parameterName: parameterName,
    resultValue: resultValue,
    unit: unit,
    normalRange: normalRange,
    reportPriority: reportPriority,
  );
}

void main() {
  test('Splits multi-line normalRange into box rows', () {
    final pages = ReportPagination.paginate([
      _item(
        testId: 1,
        testName: 'GLUCOSE',
        resultValue: '90',
        unit: 'mg/dL',
        normalRange: '70-110\nFASTING\n\nADULTS',
      ),
    ]);

    expect(pages, hasLength(1));
    expect(pages.first.rows, hasLength(3));

    expect(pages.first.rows[0].kind, ReportBoxRowKind.data);
    expect(pages.first.rows[0].normal, '70-110');

    expect(pages.first.rows[1].kind, ReportBoxRowKind.normalOnly);
    expect(pages.first.rows[1].normal, 'FASTING');

    expect(pages.first.rows[2].kind, ReportBoxRowKind.normalOnly);
    expect(pages.first.rows[2].normal, 'ADULTS');
  });

  test('Filters redundant empty group row when header is shown', () {
    final pages = ReportPagination.paginate([
      _item(testId: 10, testName: 'CBC', parameterName: ''),
      _item(
        testId: 10,
        testName: 'CBC',
        parameterName: 'HB',
        resultValue: '13.2',
        unit: 'g/dL',
        normalRange: '12-16',
      ),
    ]);

    expect(pages, hasLength(1));
    expect(pages.first.rows.first.kind, ReportBoxRowKind.testHeader);
    expect(pages.first.rows.first.testName, 'CBC');

    final dataRows =
        pages.expand((p) => p.rows).where((r) => r.kind == ReportBoxRowKind.data);
    expect(dataRows, hasLength(1));
    expect(dataRows.first.testOrParameter, 'HB');
  });

  test('Never exceeds 29 boxes per page', () {
    final items = List<ReportItem>.generate(
      30,
      (i) => _item(
        testId: 1000 + i,
        testName: 'T$i',
        resultValue: '$i',
        normalRange: 'N',
      ),
    );

    final pages = ReportPagination.paginate(items);
    expect(pages, hasLength(2));
    expect(pages[0].rows.length, lessThanOrEqualTo(kReportBoxesPerPage));
    expect(pages[1].rows.length, lessThanOrEqualTo(kReportBoxesPerPage));
  });

  test('Repeats test header when a group spans multiple pages', () {
    final items = List<ReportItem>.generate(
      40,
      (i) => _item(
        testId: 1,
        testName: 'LARGE PANEL',
        parameterName: 'P$i',
        resultValue: '$i',
        normalRange: 'N',
      ),
    );

    final pages = ReportPagination.paginate(items);
    expect(pages.length, greaterThan(1));

    for (final p in pages) {
      expect(p.rows, isNotEmpty);
      expect(p.rows.length, lessThanOrEqualTo(kReportBoxesPerPage));
      expect(p.rows.first.kind, ReportBoxRowKind.testHeader);
      expect(p.rows.first.testName, 'LARGE PANEL');
    }

    final dataRows =
        pages.expand((p) => p.rows).where((r) => r.kind == ReportBoxRowKind.data);
    expect(dataRows, hasLength(40));
  });

  test('Moves a logical block to the next page when it does not fit', () {
    final items = <ReportItem>[
      for (int i = 0; i < 25; i++)
        _item(
          testId: 1000 + i,
          testName: 'T$i',
          resultValue: '$i',
          normalRange: 'N',
        ),
      _item(
        testId: 9999,
        testName: 'BIG',
        resultValue: 'X',
        normalRange: '1\n2\n3\n4\n5',
      ),
    ];

    final pages = ReportPagination.paginate(items);
    expect(pages, hasLength(2));
    expect(pages.first.rows, hasLength(25));
    expect(pages.last.rows.first.testName, 'BIG');
    expect(pages.last.rows.first.kind, ReportBoxRowKind.data);
  });

  test('Preserves backend order (no priority sort)', () {
    final pages = ReportPagination.paginate([
      _item(testId: 1, testName: 'T1', normalRange: 'N', reportPriority: 3),
      _item(testId: 2, testName: 'T2', normalRange: 'N', reportPriority: 1),
      _item(testId: 3, testName: 'T3', normalRange: 'N', reportPriority: 2),
    ]);

    final dataRows = pages
        .expand((p) => p.rows)
        .where((r) => r.kind == ReportBoxRowKind.data)
        .toList(growable: false);
    expect(dataRows.map((r) => r.testName), ['T1', 'T2', 'T3']);
  });
}
