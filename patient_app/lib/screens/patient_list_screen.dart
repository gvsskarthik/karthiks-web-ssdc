import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import '../models/patient.dart';
import '../services/api_service.dart';
import '../services/storage_service.dart';
import '../utils/theme.dart';
import 'login_screen.dart';
import 'report_screen.dart';

class PatientListScreen extends StatefulWidget {
  final String mobile;
  final String patientName;

  const PatientListScreen({super.key, required this.mobile, required this.patientName});

  @override
  State<PatientListScreen> createState() => _PatientListScreenState();
}

class _PatientListScreenState extends State<PatientListScreen> {
  List<Patient>? _patients;
  String? _error;
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    _loadVisits();
  }

  Future<void> _loadVisits() async {
    setState(() { _loading = true; _error = null; });
    try {
      final password = await StorageService.getPassword() ?? '';
      final list = await ApiService.getVisits(widget.mobile, password);
      setState(() { _patients = list; _loading = false; });
    } catch (e) {
      setState(() { _error = e.toString(); _loading = false; });
    }
  }

  Future<void> _logout() async {
    final confirm = await showDialog<bool>(
      context: context,
      builder: (_) => AlertDialog(
        title: const Text('Sign Out'),
        content: const Text('Are you sure you want to sign out?'),
        actions: [
          TextButton(onPressed: () => Navigator.pop(context, false), child: const Text('Cancel')),
          TextButton(
              onPressed: () => Navigator.pop(context, true),
              child: const Text('Sign Out', style: TextStyle(color: AppTheme.abnormal))),
        ],
      ),
    );
    if (confirm == true) {
      await StorageService.clearSession();
      if (!mounted) return;
      Navigator.pushReplacement(context, MaterialPageRoute(builder: (_) => const LoginScreen()));
    }
  }

  String _formatDate(String? dateStr) {
    if (dateStr == null) return '';
    try {
      return DateFormat('dd MMM yyyy').format(DateTime.parse(dateStr));
    } catch (_) { return dateStr; }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('My Reports', style: TextStyle(fontSize: 18)),
        actions: [
          IconButton(icon: const Icon(Icons.refresh), onPressed: _loadVisits, tooltip: 'Refresh'),
          IconButton(icon: const Icon(Icons.logout), onPressed: _logout, tooltip: 'Sign Out'),
        ],
      ),
      body: Column(
        children: [
          Container(
            width: double.infinity,
            color: AppTheme.primary,
            padding: const EdgeInsets.fromLTRB(16, 0, 16, 12),
            child: Text('Welcome, ${widget.patientName}',
                style: const TextStyle(color: Colors.white70, fontSize: 13)),
          ),
          Expanded(
            child: _loading
                ? const Center(child: CircularProgressIndicator())
                : _error != null
                    ? _buildError()
                    : (_patients == null || _patients!.isEmpty)
                        ? _buildEmpty()
                        : _buildList(),
          ),
        ],
      ),
    );
  }

  Widget _buildList() {
    return RefreshIndicator(
      onRefresh: _loadVisits,
      child: ListView.builder(
        padding: const EdgeInsets.all(16),
        itemCount: _patients!.length,
        itemBuilder: (_, i) {
          final p = _patients![i];
          return _PatientCard(
            patient: p,
            dateStr: _formatDate(p.visitDate),
            onTap: p.isCompleted
                ? () => Navigator.push(
                    context,
                    MaterialPageRoute(builder: (_) => ReportScreen(patient: p)),
                  )
                : null,
          );
        },
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
            const Icon(Icons.cloud_off, size: 56, color: AppTheme.textSecondary),
            const SizedBox(height: 12),
            Text(_error!, textAlign: TextAlign.center,
                style: const TextStyle(color: AppTheme.textSecondary)),
            const SizedBox(height: 16),
            ElevatedButton(onPressed: _loadVisits, child: const Text('Retry')),
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
          Icon(Icons.folder_open, size: 56, color: AppTheme.textSecondary),
          SizedBox(height: 12),
          Text('No reports found for this number.',
              style: TextStyle(color: AppTheme.textSecondary)),
        ],
      ),
    );
  }
}

class _PatientCard extends StatelessWidget {
  final Patient patient;
  final String dateStr;
  final VoidCallback? onTap;

  const _PatientCard({required this.patient, required this.dateStr, required this.onTap});

  @override
  Widget build(BuildContext context) {
    return Card(
      margin: const EdgeInsets.only(bottom: 12),
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(12),
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  Expanded(
                    child: Text(patient.name,
                        style: const TextStyle(
                            fontSize: 17, fontWeight: FontWeight.bold, color: AppTheme.textPrimary)),
                  ),
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                    decoration: BoxDecoration(
                      color: patient.isCompleted
                          ? AppTheme.completed.withAlpha(31)
                          : AppTheme.pending.withAlpha(31),
                      borderRadius: BorderRadius.circular(20),
                    ),
                    child: Text(
                      patient.isCompleted ? 'Completed' : 'Pending',
                      style: TextStyle(
                        fontSize: 12,
                        fontWeight: FontWeight.w600,
                        color: patient.isCompleted ? AppTheme.completed : AppTheme.pending,
                      ),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 8),
              _Row(icon: Icons.person_outline, text: patient.ageSex),
              if (dateStr.isNotEmpty) _Row(icon: Icons.calendar_today_outlined, text: dateStr),
              if (patient.address != null && patient.address!.isNotEmpty)
                _Row(icon: Icons.location_on_outlined, text: patient.address!),
              if (patient.doctor != null && patient.doctor!.isNotEmpty)
                _Row(icon: Icons.medical_services_outlined, text: 'Dr. ${patient.doctor}'),
              const SizedBox(height: 8),
              Align(
                alignment: Alignment.centerRight,
                child: Text(
                  patient.isCompleted ? 'View Report →' : 'Report not ready yet',
                  style: TextStyle(
                    fontSize: 13,
                    color: patient.isCompleted ? AppTheme.primary : AppTheme.textSecondary,
                    fontWeight: FontWeight.w500,
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _Row extends StatelessWidget {
  final IconData icon;
  final String text;
  const _Row({required this.icon, required this.text});

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(top: 4),
      child: Row(
        children: [
          Icon(icon, size: 15, color: AppTheme.textSecondary),
          const SizedBox(width: 6),
          Expanded(
            child: Text(text,
                style: const TextStyle(fontSize: 13, color: AppTheme.textSecondary),
                maxLines: 2, overflow: TextOverflow.ellipsis),
          ),
        ],
      ),
    );
  }
}
