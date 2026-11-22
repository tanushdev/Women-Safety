import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:vibration/vibration.dart';
import '../../../shared/theme/app_theme.dart';
import '../../../core/services/api_service.dart';

class DeadMansSwitchScreen extends ConsumerStatefulWidget {
  const DeadMansSwitchScreen({super.key});

  @override
  ConsumerState<DeadMansSwitchScreen> createState() => _DeadMansSwitchScreenState();
}

class _DeadMansSwitchScreenState extends ConsumerState<DeadMansSwitchScreen> {
  int _selectedMinutes = 15;
  bool _isActive = false;
  int _remainingSeconds = 0;
  Timer? _timer;

  void _startTimer() {
    setState(() {
      _isActive = true;
      _remainingSeconds = _selectedMinutes * 60;
    });

    _timer?.cancel();
    _timer = Timer.periodic(const Duration(seconds: 1), (timer) {
      if (_remainingSeconds > 0) {
        setState(() => _remainingSeconds--);

        // Vibrate warning at 30 seconds left
        if (_remainingSeconds == 30) {
          Vibration.vibrate(pattern: [500, 500, 500]);
        }
      } else {
        // Time expired! Auto-trigger SOS
        timer.cancel();
        _triggerAutoSOS();
      }
    });

    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text('Safety Timer armed for $_selectedMinutes minutes. Check in before it expires!'),
        backgroundColor: Colors.teal,
      ),
    );
  }

  void _triggerAutoSOS() {
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(
        content: Text('🚨 Safety Timer expired without check-in! Launching SOS...'),
        backgroundColor: AppColors.danger,
      ),
    );
    context.push('/sos');
  }

  void _cancelTimer() {
    _timer?.cancel();
    setState(() {
      _isActive = false;
      _remainingSeconds = 0;
    });
    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(content: Text('Safety Timer cancelled. You are marked safe.')),
    );
  }

  @override
  void dispose() {
    _timer?.cancel();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final minutes = _remainingSeconds ~/ 60;
    final seconds = _remainingSeconds % 60;

    return Scaffold(
      appBar: AppBar(
        title: const Text('Safety Timer (Dead Man Switch)'),
      ),
      body: Padding(
        padding: const EdgeInsets.all(24.0),
        child: Column(
          children: [
            Container(
              padding: const EdgeInsets.all(16),
              decoration: BoxDecoration(
                color: Colors.blue.shade50,
                borderRadius: BorderRadius.circular(12),
                border: Border.all(color: Colors.blue.shade200),
              ),
              child: const Row(
                children: [
                  Icon(Icons.security, color: Colors.blue, size: 28),
                  SizedBox(width: 12),
                  Expanded(
                    child: Text(
                      'If you enter a cab, building, or meeting and do not check in before time expires, the app automatically alerts emergency contacts.',
                      style: TextStyle(fontSize: 13, height: 1.4),
                    ),
                  ),
                ],
              ),
            ),
            const Spacer(),
            if (!_isActive) ...[
              const Text('Select Timer Duration', style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold)),
              const SizedBox(height: 16),
              Wrap(
                spacing: 12,
                children: [5, 10, 15, 30, 60].map((m) {
                  final selected = _selectedMinutes == m;
                  return ChoiceChip(
                    label: Text('$m min'),
                    selected: selected,
                    onSelected: (val) {
                      if (val) setState(() => _selectedMinutes = m);
                    },
                    selectedColor: AppColors.primary.withOpacity(0.2),
                  );
                }).toList(),
              ),
              const SizedBox(height: 40),
              SizedBox(
                width: double.infinity,
                child: ElevatedButton.icon(
                  onPressed: _startTimer,
                  icon: const Icon(Icons.timer),
                  label: Text('Arm Timer for $_selectedMinutes Minutes', style: const TextStyle(fontSize: 16)),
                  style: ElevatedButton.styleFrom(
                    padding: const EdgeInsets.symmetric(vertical: 16),
                    backgroundColor: AppColors.primary,
                    foregroundColor: Colors.white,
                  ),
                ),
              ),
            ] else ...[
              Container(
                width: 220,
                height: 220,
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  border: Border.all(color: AppColors.danger, width: 8),
                  color: Colors.red.shade50,
                ),
                child: Center(
                  child: Column(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      Text(
                        '${minutes.toString().padLeft(2, '0')}:${seconds.toString().padLeft(2, '0')}',
                        style: const TextStyle(fontSize: 44, fontWeight: FontWeight.bold, color: AppColors.danger),
                      ),
                      const Text('Remaining', style: TextStyle(color: Colors.grey)),
                    ],
                  ),
                ),
              ),
              const SizedBox(height: 40),
              SizedBox(
                width: double.infinity,
                child: ElevatedButton.icon(
                  onPressed: _cancelTimer,
                  icon: const Icon(Icons.check_circle, color: Colors.white),
                  label: const Text('I am Safe - Cancel Timer', style: TextStyle(fontSize: 16, color: Colors.white)),
                  style: ElevatedButton.styleFrom(
                    backgroundColor: Colors.green,
                    padding: const EdgeInsets.symmetric(vertical: 16),
                  ),
                ),
              ),
            ],
            const Spacer(),
          ],
        ),
      ),
    );
  }
}
