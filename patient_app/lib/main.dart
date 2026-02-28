import 'package:flutter/material.dart';
import 'services/storage_service.dart';
import 'screens/login_screen.dart';
import 'screens/patient_list_screen.dart';
import 'utils/theme.dart';

void main() async {
  WidgetsFlutterBinding.ensureInitialized();
  runApp(const PatientApp());
}

class PatientApp extends StatelessWidget {
  const PatientApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'SSDC Labs',
      theme: AppTheme.theme,
      debugShowCheckedModeBanner: false,
      home: const _StartupRouter(),
    );
  }
}

class _StartupRouter extends StatefulWidget {
  const _StartupRouter();

  @override
  State<_StartupRouter> createState() => _StartupRouterState();
}

class _StartupRouterState extends State<_StartupRouter> {
  @override
  void initState() {
    super.initState();
    _checkSession();
  }

  Future<void> _checkSession() async {
    final mobile = await StorageService.getMobile();
    final name = await StorageService.getName();
    if (!mounted) return;
    if (mobile != null && name != null) {
      Navigator.pushReplacement(
        context,
        MaterialPageRoute(
          builder: (_) => PatientListScreen(mobile: mobile, patientName: name),
        ),
      );
    } else {
      Navigator.pushReplacement(
        context,
        MaterialPageRoute(builder: (_) => const LoginScreen()),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    return const Scaffold(
      backgroundColor: Color(0xFF1565C0),
      body: Center(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(Icons.local_hospital, size: 64, color: Colors.white),
            SizedBox(height: 16),
            Text(
              'SSDC Labs',
              style: TextStyle(
                fontSize: 28,
                fontWeight: FontWeight.bold,
                color: Colors.white,
              ),
            ),
          ],
        ),
      ),
    );
  }
}
