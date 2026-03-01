import 'dart:typed_data';

import 'package:intl/intl.dart';
import 'package:pdf/pdf.dart';
import 'package:pdf/widgets.dart' as pw;
import 'package:printing/printing.dart';

import '../models/patient.dart';
import '../models/report_item.dart';
import 'report_pagination.dart';

enum ReportPdfMode { normal, letterhead }

class PdfGenerator {
  static const _border = PdfColor.fromInt(0xFFCCCCCC);
  static const _abnormal = PdfColor.fromInt(0xFFD32F2F);
  static const _textDark = PdfColor.fromInt(0xFF111111);
  static const _textMid = PdfColor.fromInt(0xFF444444);

  static const double _pagePadding = 10 * PdfPageFormat.mm;
  static const double _letterheadLine = 4 * PdfPageFormat.mm;
  static const _colFlex = [5, 2, 2, 4];

  static Future<void> shareReport(
    Patient patient,
    List<ReportItem> items, {
    ReportPdfMode mode = ReportPdfMode.normal,
    int letterheadTopLines = 0,
    int letterheadBottomLines = 0,
    int letterheadLeftLines = 0,
    int letterheadRightLines = 0,
  }) async {
    final bytes = await _buildReportPdfBytes(
      patient,
      items,
      mode: mode,
      letterheadTopLines: letterheadTopLines,
      letterheadBottomLines: letterheadBottomLines,
      letterheadLeftLines: letterheadLeftLines,
      letterheadRightLines: letterheadRightLines,
    );
    final filename = _filename(patient);

    await Printing.sharePdf(bytes: bytes, filename: filename);
  }

  static Future<void> printReport(
    Patient patient,
    List<ReportItem> items, {
    ReportPdfMode mode = ReportPdfMode.normal,
    int letterheadTopLines = 0,
    int letterheadBottomLines = 0,
    int letterheadLeftLines = 0,
    int letterheadRightLines = 0,
  }) async {
    final bytes = await _buildReportPdfBytes(
      patient,
      items,
      mode: mode,
      letterheadTopLines: letterheadTopLines,
      letterheadBottomLines: letterheadBottomLines,
      letterheadLeftLines: letterheadLeftLines,
      letterheadRightLines: letterheadRightLines,
    );
    final filename = _filename(patient);

    await Printing.layoutPdf(
      name: filename,
      onLayout: (_) async => bytes,
    );
  }

  static Future<Uint8List> _buildReportPdfBytes(
    Patient patient,
    List<ReportItem> items, {
    required ReportPdfMode mode,
    int letterheadTopLines = 0,
    int letterheadBottomLines = 0,
    int letterheadLeftLines = 0,
    int letterheadRightLines = 0,
  }) async {
    final pdf = pw.Document();

    final date = formatDate(patient.visitDate);
    final doctor =
        (patient.doctor?.isNotEmpty ?? false) ? patient.doctor! : 'SELF';
    final address =
        (patient.address?.isNotEmpty ?? false) ? patient.address! : '-';
    final mobile =
        (patient.mobile?.isNotEmpty ?? false) ? patient.mobile! : '-';

    final extra = mode == ReportPdfMode.letterhead
        ? pw.EdgeInsets.fromLTRB(
            letterheadLeftLines * _letterheadLine,
            letterheadTopLines * _letterheadLine,
            letterheadRightLines * _letterheadLine,
            letterheadBottomLines * _letterheadLine,
          )
        : pw.EdgeInsets.zero;

    final margin = pw.EdgeInsets.fromLTRB(
      _pagePadding + extra.left,
      _pagePadding + extra.top,
      _pagePadding + extra.right,
      _pagePadding + extra.bottom,
    );

    final reduceBoxes = mode == ReportPdfMode.letterhead
        ? (letterheadTopLines + letterheadBottomLines)
        : 0;
    final boxesPerPage =
        (kReportBoxesPerPage - reduceBoxes).clamp(10, kReportBoxesPerPage).toInt();

    final pages = ReportPagination.paginate(items, boxesPerPage: boxesPerPage);
    final pagesOrEmpty =
        pages.isNotEmpty ? pages : const <ReportPage>[ReportPage(<ReportBoxRow>[])];

    for (final page in pagesOrEmpty) {
      pdf.addPage(
        pw.Page(
          pageFormat: PdfPageFormat.a4,
          margin: margin,
          build: (_) => _pdfPage(
            patient: patient,
            date: date,
            doctor: doctor,
            address: address,
            mobile: mobile,
            showLabHeader: mode == ReportPdfMode.normal,
            page: page,
          ),
        ),
      );
    }

    return pdf.save();
  }

  static String _filename(Patient patient) {
    final date = formatDate(patient.visitDate);
    final safeName = patient.name.replaceAll(' ', '_');
    return 'report_${safeName}_$date.pdf';
  }

  static String formatDate(String? dateStr) {
    if (dateStr == null || dateStr.trim().isEmpty) return '';
    try {
      return DateFormat('dd-MM-yyyy').format(DateTime.parse(dateStr));
    } catch (_) {
      return dateStr;
    }
  }

  static pw.Widget _pdfPage({
    required Patient patient,
    required String date,
    required String doctor,
    required String address,
    required String mobile,
    required bool showLabHeader,
    required ReportPage page,
  }) {
    final tableRows = <pw.Widget>[_pdfColHeaderRow(), ...page.rows.map(_pdfBoxRow)];
    final table = pw.Column(
      crossAxisAlignment: pw.CrossAxisAlignment.stretch,
      children: tableRows,
    );

    return pw.Column(
      crossAxisAlignment: pw.CrossAxisAlignment.stretch,
      children: [
        if (showLabHeader) ...[
          _pdfLabHeader(),
          pw.SizedBox(height: 10),
        ],
        _pdfPatientInfoTable(
          patient: patient,
          date: date,
          address: address,
          doctor: doctor,
          mobile: mobile,
        ),
        pw.SizedBox(height: 8),
        pw.Expanded(
          child: page.rows.isEmpty
              ? pw.Center(
                  child: pw.Text(
                    'No report data',
                    style: const pw.TextStyle(fontSize: 10, color: _textMid),
                  ),
                )
              : table,
        ),
        pw.SizedBox(height: 8),
        _pdfPageFooter(),
      ],
    );
  }

  static pw.Widget _pdfLabHeader() {
    return pw.Center(
      child: pw.Column(
        crossAxisAlignment: pw.CrossAxisAlignment.center,
        children: [
          pw.Text(
            'SAI SREE SWETHA DIAGNOSTICS',
            style: pw.TextStyle(
              fontSize: 18,
              fontWeight: pw.FontWeight.bold,
              color: _textDark,
              letterSpacing: 0.3,
            ),
          ),
          pw.SizedBox(height: 3),
          pw.Text(
            'BLOOD EXAMINATION REPORT',
            style: pw.TextStyle(
              fontSize: 11,
              fontWeight: pw.FontWeight.bold,
              color: _textDark,
              letterSpacing: 0.5,
            ),
          ),
        ],
      ),
    );
  }

  static pw.Widget _pdfPatientInfoTable({
    required Patient patient,
    required String date,
    required String address,
    required String doctor,
    required String mobile,
  }) {
    return pw.Table(
      columnWidths: const {
        0: pw.FlexColumnWidth(1),
        1: pw.FlexColumnWidth(1),
      },
      children: [
        pw.TableRow(children: [
          _pdfMetaField('PATIENT', patient.name),
          _pdfMetaField('DATE', date),
        ]),
        pw.TableRow(children: [
          _pdfMetaField('ADDRESS', address),
          _pdfMetaField('AGE / SEX', patient.ageSex),
        ]),
        pw.TableRow(children: [
          _pdfMetaField('REF BY Dr.', doctor),
          _pdfMetaField('MOBILE', mobile),
        ]),
      ],
    );
  }

  static pw.Widget _pdfPageFooter() {
    return pw.Column(
      crossAxisAlignment: pw.CrossAxisAlignment.stretch,
      children: [
        pw.RichText(
          text: pw.TextSpan(children: [
            pw.TextSpan(
              text: 'Red',
              // The `pdf` package is still on Dart language version 2.19, where
              // const-eval does not allow enum comparisons used in `TextStyle`.
              // ignore: prefer_const_constructors
              style: pw.TextStyle(
                color: _abnormal,
                fontWeight: pw.FontWeight.bold,
                fontSize: 9,
              ),
            ),
            // ignore: prefer_const_constructors
            pw.TextSpan(
              text: ' = Abnormal value',
              // ignore: prefer_const_constructors
              style: pw.TextStyle(
                color: _textMid,
                fontSize: 9,
              ),
            ),
          ]),
        ),
        pw.SizedBox(height: 8),
        pw.Align(
          alignment: pw.Alignment.centerRight,
          child: pw.Padding(
            padding: const pw.EdgeInsets.only(right: 100),
            child: pw.Text(
              'SIGNATURE',
              style: pw.TextStyle(
                fontSize: 9,
                fontWeight: pw.FontWeight.bold,
                letterSpacing: 0.3,
                color: _textMid,
              ),
            ),
          ),
        ),
        pw.Text(
          'SUGGESTED CLINICAL CORRELATION',
          style: pw.TextStyle(
            fontSize: 9,
            fontWeight: pw.FontWeight.bold,
            letterSpacing: 0.3,
            color: _textMid,
          ),
        ),
      ],
    );
  }

  // ── Table helpers ──────────────────────────────────────────────

  static pw.Widget _pdfMetaField(String label, String value) {
    return pw.RichText(
      text: pw.TextSpan(
        // ignore: prefer_const_constructors
        style: pw.TextStyle(fontSize: 10, color: _textDark),
        children: [
          pw.TextSpan(
            text: '$label : ',
            // ignore: prefer_const_constructors
            style: pw.TextStyle(fontWeight: pw.FontWeight.bold),
          ),
          pw.TextSpan(text: value),
        ],
      ),
    );
  }

  static pw.Widget _pdfColHeaderRow() {
    const labels = ['TEST', 'RESULT', 'UNIT', 'NORMAL VALUES'];
    return pw.Container(
      decoration: const pw.BoxDecoration(
        color: PdfColors.white,
        border: pw.Border(
          left: pw.BorderSide(color: _border, width: 0.7),
          right: pw.BorderSide(color: _border, width: 0.7),
          top: pw.BorderSide(color: _border, width: 0.7),
          bottom: pw.BorderSide(color: _border, width: 0.7),
        ),
      ),
      child: pw.Row(
        children: [
          for (int i = 0; i < 4; i++)
            pw.Expanded(
              flex: _colFlex[i],
              child: pw.Container(
                decoration: i > 0
                    ? const pw.BoxDecoration(
                        border: pw.Border(
                          left: pw.BorderSide(color: _border, width: 0.7),
                        ),
                      )
                    : null,
                padding: const pw.EdgeInsets.all(4),
                child: pw.Text(
                  labels[i],
                  style: pw.TextStyle(
                    fontWeight: pw.FontWeight.bold,
                    fontSize: 10,
                    letterSpacing: 0.3,
                    color: _textDark,
                  ),
                ),
              ),
            ),
        ],
      ),
    );
  }

  static pw.Widget _pdfBoxRow(ReportBoxRow row) {
    switch (row.kind) {
      case ReportBoxRowKind.testHeader:
        return _pdfSectionHeaderRow(row.testName);
      case ReportBoxRowKind.data:
        return _pdfDataBoxRow(row);
      case ReportBoxRowKind.normalOnly:
        return _pdfNormalOnlyRow(row);
    }
  }

  static pw.Widget _pdfSectionHeaderRow(String name) {
    return pw.Container(
      width: double.infinity,
      decoration: const pw.BoxDecoration(
        color: PdfColors.white,
        border: pw.Border(
          left: pw.BorderSide(color: _border, width: 0.7),
          right: pw.BorderSide(color: _border, width: 0.7),
          bottom: pw.BorderSide(color: _border, width: 0.5),
        ),
      ),
      padding: const pw.EdgeInsets.fromLTRB(4, 8, 4, 4),
      child: pw.Text(
        name,
        maxLines: 1,
        overflow: pw.TextOverflow.clip,
        style: pw.TextStyle(
          fontWeight: pw.FontWeight.bold,
          fontSize: 10,
          letterSpacing: 0.6,
          color: _textDark,
        ),
      ),
    );
  }

  static pw.Widget _pdfDataBoxRow(ReportBoxRow row) {
    final cells = [
      row.testOrParameter,
      row.result.isNotEmpty ? row.result : '-',
      row.unit,
      row.normal,
    ];

    return pw.Container(
      decoration: const pw.BoxDecoration(
        color: PdfColors.white,
        border: pw.Border(
          left: pw.BorderSide(color: _border, width: 0.7),
          right: pw.BorderSide(color: _border, width: 0.7),
          bottom: pw.BorderSide(color: _border, width: 0.5),
        ),
      ),
      child: pw.Row(
        crossAxisAlignment: pw.CrossAxisAlignment.start,
        children: [
          for (int i = 0; i < 4; i++)
            pw.Expanded(
              flex: _colFlex[i],
              child: pw.Container(
                decoration: i > 0
                    ? const pw.BoxDecoration(
                        border: pw.Border(
                          left: pw.BorderSide(color: _border, width: 0.5),
                        ),
                      )
                    : null,
                padding: pw.EdgeInsets.fromLTRB(
                  i == 0 ? (row.indentTestOrParameter ? 20 : 4) : 4,
                  4,
                  4,
                  4,
                ),
                child: pw.Text(
                  cells[i],
                  maxLines: 1,
                  softWrap: false,
                  overflow: pw.TextOverflow.clip,
                  style: pw.TextStyle(
                    fontSize: 9,
                    color: (i == 1 && row.abnormalResult) ? _abnormal : _textDark,
                    fontWeight: (i == 1 && row.abnormalResult)
                        ? pw.FontWeight.bold
                        : pw.FontWeight.normal,
                  ),
                ),
              ),
            ),
        ],
      ),
    );
  }

  static pw.Widget _pdfNormalOnlyRow(ReportBoxRow row) {
    final cells = ['', '', '', row.normal];

    return pw.Container(
      decoration: const pw.BoxDecoration(
        color: PdfColors.white,
        border: pw.Border(
          left: pw.BorderSide(color: _border, width: 0.7),
          right: pw.BorderSide(color: _border, width: 0.7),
          bottom: pw.BorderSide(color: _border, width: 0.5),
        ),
      ),
      child: pw.Row(
        crossAxisAlignment: pw.CrossAxisAlignment.start,
        children: [
          for (int i = 0; i < 4; i++)
            pw.Expanded(
              flex: _colFlex[i],
              child: pw.Container(
                decoration: i > 0
                    ? const pw.BoxDecoration(
                        border: pw.Border(
                          left: pw.BorderSide(color: _border, width: 0.5),
                        ),
                      )
                    : null,
                padding: const pw.EdgeInsets.all(4),
                child: pw.Text(
                  cells[i],
                  maxLines: 1,
                  softWrap: false,
                  overflow: pw.TextOverflow.clip,
                  style: const pw.TextStyle(fontSize: 9, color: _textDark),
                ),
              ),
            ),
        ],
      ),
    );
  }
}
