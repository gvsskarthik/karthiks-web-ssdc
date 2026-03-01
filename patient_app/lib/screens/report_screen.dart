import 'package:flutter/material.dart';
import 'package:flutter/foundation.dart';
import 'package:intl/intl.dart';
import '../models/patient.dart';
import '../models/report_item.dart';
import '../services/api_service.dart';
import '../services/storage_service.dart';
import '../utils/theme.dart';
import '../utils/pdf_generator.dart';
import '../utils/report_pagination.dart';

const _cellBorder = Color(0xFFCCCCCC);
const _colFlex = [5, 2, 2, 4];
const _a4Width = 595.0; // A4 @ 72dpi points (matches PDF)
const _a4Height = _a4Width * (297 / 210);
const _pagePadding = 28.0; // ~10mm
const _pageGap = 14.0;
const _tableFontSize = 8.5;
const _metaFontSize = 9.5;

enum _PrintAction { normal, letterhead, editLetterhead }

class ReportScreen extends StatefulWidget {
  final Patient patient;
  const ReportScreen({super.key, required this.patient});

  @override
  State<ReportScreen> createState() => _ReportScreenState();
}

class _ReportScreenState extends State<ReportScreen> {
  List<ReportItem>? _items;
  String? _error;
  bool _loading = true;
  bool _busy = false;
  final TransformationController _zoomController = TransformationController();
  double? _lastViewportWidth;

  @override
  void initState() {
    super.initState();
    _loadReport();
  }

  @override
  void dispose() {
    _zoomController.dispose();
    super.dispose();
  }

  void _initZoom(double viewportWidth) {
    if (_lastViewportWidth != null &&
        (viewportWidth - _lastViewportWidth!).abs() < 0.5) {
      return;
    }
    _lastViewportWidth = viewportWidth;

    const canvasWidth = _a4Width + 24; // 12px padding on both sides
    final scale = (viewportWidth / canvasWidth).clamp(0.25, 1.0).toDouble();
    final dx = (viewportWidth - (canvasWidth * scale)) / 2;

    final matrix = Matrix4.identity();
    matrix.setTranslationRaw(dx, 0.0, 0.0);
    matrix.setEntry(0, 0, scale);
    matrix.setEntry(1, 1, scale);
    _zoomController.value = matrix;
  }

  Future<void> _loadReport() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final items = await ApiService.getReport(widget.patient.id, widget.patient.mobile ?? '');
      if (kDebugMode) {
        final count = items.length;
        debugPrint('Report items loaded: $count');
        for (var i = 0; i < items.length && i < 40; i++) {
          final it = items[i];
          debugPrint(
            '${i + 1}. testId=${it.testId} pri=${it.reportPriority ?? '-'} test="${it.testName}" param="${it.parameterName}"',
          );
        }
      }
      setState(() {
        _items = items;
        _loading = false;
      });
    } catch (e) {
      setState(() {
        _error = e.toString();
        _loading = false;
      });
    }
  }

  Future<void> _shareAsPdf() async {
    if (_items == null || _items!.isEmpty) return;
    setState(() => _busy = true);
    try {
      await PdfGenerator.shareReport(
        widget.patient,
        _items!,
        mode: ReportPdfMode.normal,
      );
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Could not generate PDF: $e')),
        );
      }
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _printReport(ReportPdfMode mode) async {
    if (_items == null || _items!.isEmpty) return;
    setState(() => _busy = true);
    try {
      final lines = mode == ReportPdfMode.letterhead
          ? await StorageService.getLetterheadLines()
          : const LetterheadLines(top: 0, bottom: 0, left: 0, right: 0);

      await PdfGenerator.printReport(
        widget.patient,
        _items!,
        mode: mode,
        letterheadTopLines: lines.top,
        letterheadBottomLines: lines.bottom,
        letterheadLeftLines: lines.left,
        letterheadRightLines: lines.right,
      );
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Could not print: $e')),
        );
      }
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _showPrintOptions() async {
    final current = await StorageService.getLetterheadLines();
    if (!mounted) return;

    final action = await showModalBottomSheet<_PrintAction>(
      context: context,
      builder: (context) => SafeArea(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            ListTile(
              leading: const Icon(Icons.print_outlined),
              title: const Text('Print (without letterhead)'),
              onTap: () => Navigator.pop(context, _PrintAction.normal),
            ),
            ListTile(
              leading: const Icon(Icons.article_outlined),
              title: const Text('Print (letterhead)'),
              subtitle: Text(
                  'Lines — T:${current.top} B:${current.bottom} L:${current.left} R:${current.right}'),
              onTap: () => Navigator.pop(context, _PrintAction.letterhead),
            ),
            ListTile(
              leading: const Icon(Icons.tune_outlined),
              title: const Text('Edit letterhead spacing'),
              subtitle: const Text('1 line = 4mm'),
              onTap: () => Navigator.pop(context, _PrintAction.editLetterhead),
            ),
            const SizedBox(height: 6),
          ],
        ),
      ),
    );

    if (!mounted || action == null) return;
    if (action == _PrintAction.editLetterhead) {
      await _editLetterheadSpacing();
      return;
    }

    await _printReport(
      action == _PrintAction.letterhead
          ? ReportPdfMode.letterhead
          : ReportPdfMode.normal,
    );
  }

  Future<void> _editLetterheadSpacing() async {
    final current = await StorageService.getLetterheadLines();
    if (!mounted) return;

    final top = TextEditingController(text: current.top.toString());
    final bottom = TextEditingController(text: current.bottom.toString());
    final left = TextEditingController(text: current.left.toString());
    final right = TextEditingController(text: current.right.toString());

    LetterheadLines parse() {
      int parseInt(TextEditingController c) => int.tryParse(c.text.trim()) ?? 0;

      return LetterheadLines(
        top: parseInt(top).clamp(0, 50).toInt(),
        bottom: parseInt(bottom).clamp(0, 50).toInt(),
        left: parseInt(left).clamp(0, 50).toInt(),
        right: parseInt(right).clamp(0, 50).toInt(),
      );
    }

    final saved = await showDialog<LetterheadLines>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Letterhead spacing'),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            TextField(
              controller: top,
              keyboardType: TextInputType.number,
              decoration: const InputDecoration(labelText: 'Top lines'),
            ),
            TextField(
              controller: bottom,
              keyboardType: TextInputType.number,
              decoration: const InputDecoration(labelText: 'Bottom lines'),
            ),
            TextField(
              controller: left,
              keyboardType: TextInputType.number,
              decoration: const InputDecoration(labelText: 'Left lines'),
            ),
            TextField(
              controller: right,
              keyboardType: TextInputType.number,
              decoration: const InputDecoration(labelText: 'Right lines'),
            ),
          ],
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context),
            child: const Text('Cancel'),
          ),
          ElevatedButton(
            onPressed: () => Navigator.pop(context, parse()),
            child: const Text('Save'),
          ),
        ],
      ),
    );

    if (saved == null) return;
    await StorageService.saveLetterheadLines(
      top: saved.top,
      bottom: saved.bottom,
      left: saved.left,
      right: saved.right,
    );

    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(content: Text('Letterhead spacing saved.')),
    );
  }

  String _formatDate(String? dateStr) {
    if (dateStr == null) return '';
    try {
      return DateFormat('dd-MM-yyyy').format(DateTime.parse(dateStr));
    } catch (_) {
      return dateStr;
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppTheme.background,
      appBar: AppBar(
        title: null,
        actions: [
          if (_items != null && _items!.isNotEmpty)
            _busy
                ? const Padding(
                    padding: EdgeInsets.all(14),
                    child: SizedBox(
                        width: 22,
                        height: 22,
                        child: CircularProgressIndicator(
                            color: Colors.white, strokeWidth: 2.5)))
                : Row(
                    children: [
                      IconButton(
                        icon: const Icon(Icons.print_outlined),
                        tooltip: 'Print',
                        onPressed: _showPrintOptions,
                      ),
                      IconButton(
                        icon: const Icon(Icons.share_outlined),
                        tooltip: 'Share as PDF',
                        onPressed: _shareAsPdf,
                      ),
                    ],
                  ),
        ],
      ),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : _error != null
              ? _buildError()
              : (_items == null || _items!.isEmpty)
                  ? _buildEmpty()
                  : _buildReport(),
    );
  }

  Widget _buildReport() {
    final pages = ReportPagination.paginate(_items ?? const <ReportItem>[]);
    if (pages.isEmpty) return _buildEmpty();
    final patient = widget.patient;
    final date = _formatDate(patient.visitDate);
    final doctor =
        (patient.doctor?.isNotEmpty ?? false) ? patient.doctor! : 'SELF';
    final address =
        (patient.address?.isNotEmpty ?? false) ? patient.address! : '-';
    final mobile =
        (patient.mobile?.isNotEmpty ?? false) ? patient.mobile! : '-';

    Widget buildPatientInfo() {
      return Container(
        decoration: BoxDecoration(
          color: Colors.white,
          border: Border.all(color: _cellBorder, width: 0.7),
        ),
        padding: const EdgeInsets.all(8),
        child: Table(
          columnWidths: const {
            0: FlexColumnWidth(1),
            1: FlexColumnWidth(1),
          },
          children: [
            TableRow(children: [
              _patientField('PATIENT', patient.name),
              _patientField('DATE', date),
            ]),
            TableRow(children: [
              _patientField('ADDRESS', address),
              _patientField('AGE / SEX', patient.ageSex),
            ]),
            TableRow(children: [
              _patientField('REF BY Dr.', doctor),
              _patientField('MOBILE', mobile),
            ]),
          ],
        ),
      );
    }

    Widget buildFooter() {
      return Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          RichText(
            text: const TextSpan(
              children: [
                TextSpan(
                  text: 'Red',
                  style: TextStyle(
                    color: AppTheme.abnormal,
                    fontWeight: FontWeight.bold,
                    fontSize: _metaFontSize,
                  ),
                ),
                TextSpan(
                  text: ' = Abnormal value',
                  style: TextStyle(
                    color: Color(0xFF555555),
                    fontSize: _metaFontSize,
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 8),
          const Align(
            alignment: Alignment.centerRight,
            child: Padding(
              padding: EdgeInsets.only(right: 100),
              child: Text(
                'SIGNATURE',
                style: TextStyle(
                  fontSize: _metaFontSize,
                  fontWeight: FontWeight.bold,
                  letterSpacing: 0.3,
                  color: Color(0xFF444444),
                ),
              ),
            ),
          ),
          const Text(
            'SUGGESTED CLINICAL CORRELATION',
            style: TextStyle(
              fontSize: _metaFontSize,
              fontWeight: FontWeight.bold,
              letterSpacing: 0.3,
              color: Color(0xFF444444),
            ),
          ),
        ],
      );
    }

    Widget buildTable(ReportPage page) {
      final headerIsLast = page.rows.isEmpty;
      final rows = <Widget>[_buildColHeaderRow(isLast: headerIsLast)];
      for (int i = 0; i < page.rows.length; i++) {
        rows.add(_buildBoxRow(page.rows[i], isLast: i == page.rows.length - 1));
      }

      return Container(
        decoration: BoxDecoration(
          border: Border.all(color: _cellBorder, width: 0.7),
        ),
        child: Column(children: rows),
      );
    }

    Widget buildPage(ReportPage page) {
      return SizedBox(
        width: _a4Width,
        height: _a4Height,
        child: Container(
          decoration: BoxDecoration(
            color: Colors.white,
            border: Border.all(color: _cellBorder, width: 0.7),
          ),
          padding: const EdgeInsets.all(_pagePadding),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              const Text(
                'SAI SREE SWETHA DIAGNOSTICS',
                textAlign: TextAlign.center,
                style: TextStyle(
                  fontSize: 16,
                  fontWeight: FontWeight.bold,
                  letterSpacing: 0.3,
                  height: 1.2,
                ),
              ),
              const SizedBox(height: 2),
              const Text(
                'BLOOD EXAMINATION REPORT',
                textAlign: TextAlign.center,
                style: TextStyle(
                  fontSize: 10.5,
                  fontWeight: FontWeight.bold,
                  letterSpacing: 0.5,
                  height: 1.2,
                ),
              ),
              const SizedBox(height: 8),
              buildPatientInfo(),
              const SizedBox(height: 8),
              buildTable(page),
              const Spacer(),
              const SizedBox(height: 8),
              buildFooter(),
            ],
          ),
        ),
      );
    }

    final reportPages = Column(
      children: [
        for (int i = 0; i < pages.length; i++) ...[
          buildPage(pages[i]),
          if (i != pages.length - 1) const SizedBox(height: _pageGap),
        ],
      ],
    );

    return LayoutBuilder(
      builder: (context, constraints) {
        _initZoom(constraints.maxWidth);
        final minScale = (constraints.maxWidth / (_a4Width + 24))
            .clamp(0.25, 1.0)
            .toDouble();

        return InteractiveViewer(
          transformationController: _zoomController,
          minScale: minScale,
          maxScale: 5.0,
          boundaryMargin: const EdgeInsets.all(80),
          constrained: false,
          child: Padding(
            padding: const EdgeInsets.all(12),
            child: SizedBox(width: _a4Width, child: reportPages),
          ),
        );
      },
    );
  }

  // ── Helper widgets ────────────────────────────────────────────────

  Widget _patientField(String label, String value) {
    return RichText(
      maxLines: 1,
      overflow: TextOverflow.ellipsis,
      text: TextSpan(
        style:
            const TextStyle(
              color: Color(0xFF111111),
              fontSize: _metaFontSize,
              height: 1.2,
            ),
        children: [
          TextSpan(
              text: '$label : ',
              style: const TextStyle(fontWeight: FontWeight.bold)),
          TextSpan(text: value),
        ],
      ),
    );
  }

  Widget _buildColHeaderRow({required bool isLast}) {
    const labels = ['TEST', 'RESULT', 'UNIT', 'NORMAL VALUES'];
    return Container(
      decoration: BoxDecoration(
        color: Colors.white,
        border: isLast
            ? null
            : const Border(bottom: BorderSide(color: _cellBorder, width: 0.7)),
      ),
      child: Row(
        children: [
          for (int i = 0; i < 4; i++)
            Expanded(
              flex: _colFlex[i],
              child: Container(
                decoration: i > 0
                    ? const BoxDecoration(
                        border: Border(
                            left: BorderSide(color: _cellBorder, width: 0.7)))
                    : null,
                padding: const EdgeInsets.all(3),
                child: Text(labels[i],
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: const TextStyle(
                        fontWeight: FontWeight.bold,
                        letterSpacing: 0.3,
                        fontSize: _tableFontSize,
                        height: 1.2,
                        color: Color(0xFF111111))),
              ),
            ),
        ],
      ),
    );
  }

  Widget _buildBoxRow(ReportBoxRow row, {required bool isLast}) {
    switch (row.kind) {
      case ReportBoxRowKind.testHeader:
        return _buildTestHeaderRow(row.testName, isLast: isLast);
      case ReportBoxRowKind.data:
        return _buildDataBoxRow(row, isLast: isLast);
      case ReportBoxRowKind.normalOnly:
        return _buildNormalOnlyRow(row, isLast: isLast);
    }
  }

  Widget _buildTestHeaderRow(String name, {required bool isLast}) {
    return Container(
      width: double.infinity,
      decoration: BoxDecoration(
        color: Colors.white,
        border: isLast
            ? null
            : const Border(bottom: BorderSide(color: _cellBorder, width: 0.5)),
      ),
      padding: const EdgeInsets.fromLTRB(3, 7, 3, 3),
      child: Text(
        name,
        maxLines: 1,
        overflow: TextOverflow.ellipsis,
        style: const TextStyle(
          fontWeight: FontWeight.bold,
          fontSize: 10,
          letterSpacing: 0.6,
          height: 1.2,
          color: Color(0xFF111111),
        ),
      ),
    );
  }

  Widget _buildDataBoxRow(ReportBoxRow row, {required bool isLast}) {
    final cells = [
      row.testOrParameter,
      row.result.isNotEmpty ? row.result : '-',
      row.unit,
      row.normal,
    ];
    return Container(
      decoration: BoxDecoration(
        color: Colors.white,
        border: isLast
            ? null
            : const Border(bottom: BorderSide(color: _cellBorder, width: 0.5)),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          for (int i = 0; i < 4; i++)
            Expanded(
              flex: _colFlex[i],
              child: Container(
                decoration: i > 0
                    ? const BoxDecoration(
                        border: Border(
                            left: BorderSide(color: _cellBorder, width: 0.5)))
                    : null,
                padding: EdgeInsets.fromLTRB(
                    i == 0 ? (row.indentTestOrParameter ? 20 : 3) : 3, 3, 3, 3),
                child: Text(
                    cells[i],
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: TextStyle(
                      fontSize: _tableFontSize,
                      height: 1.2,
                      color: (i == 1 && row.abnormalResult)
                          ? AppTheme.abnormal
                          : const Color(0xFF222222),
                      fontWeight: (i == 1 && row.abnormalResult)
                          ? FontWeight.bold
                          : FontWeight.normal,
                    )),
              ),
            ),
        ],
      ),
    );
  }

  Widget _buildNormalOnlyRow(ReportBoxRow row, {required bool isLast}) {
    return Container(
      decoration: BoxDecoration(
        color: Colors.white,
        border: isLast
            ? null
            : const Border(bottom: BorderSide(color: _cellBorder, width: 0.5)),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          for (int i = 0; i < 4; i++)
            Expanded(
              flex: _colFlex[i],
              child: Container(
                decoration: i > 0
                    ? const BoxDecoration(
                        border: Border(
                            left: BorderSide(color: _cellBorder, width: 0.5)))
                    : null,
                padding: const EdgeInsets.fromLTRB(3, 3, 3, 3),
                child: Text(
                  i == 3 ? row.normal : '',
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: const TextStyle(
                    fontSize: _tableFontSize,
                    height: 1.2,
                    color: Color(0xFF222222),
                  ),
                ),
              ),
            ),
        ],
      ),
    );
  }

  Widget _buildError() {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(24),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Icon(Icons.cloud_off,
                size: 56, color: AppTheme.textSecondary),
            const SizedBox(height: 12),
            Text(_error!,
                textAlign: TextAlign.center,
                style: const TextStyle(color: AppTheme.textSecondary)),
            const SizedBox(height: 16),
            ElevatedButton(onPressed: _loadReport, child: const Text('Retry')),
          ],
        ),
      ),
    );
  }

  Widget _buildEmpty() {
    return const Center(
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(Icons.description_outlined,
              size: 56, color: AppTheme.textSecondary),
          SizedBox(height: 12),
          Text('No report data available.',
              style: TextStyle(color: AppTheme.textSecondary)),
        ],
      ),
    );
  }
}
