import 'dart:async';
import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:vibration/vibration.dart';

class FakeCallScreen extends StatefulWidget {
  const FakeCallScreen({super.key});

  @override
  State<FakeCallScreen> createState() => _FakeCallScreenState();
}

class _FakeCallScreenState extends State<FakeCallScreen> {
  bool _isAnswered = false;
  int _callSeconds = 0;
  Timer? _timer;

  @override
  void initState() {
    super.initState();
    _startVibrationRingtone();
  }

  void _startVibrationRingtone() {
    Vibration.vibrate(pattern: [1000, 1000, 1000, 1000, 1000, 1000], repeat: 1);
  }

  void _answerCall() {
    Vibration.cancel();
    setState(() => _isAnswered = true);
    _timer = Timer.periodic(const Duration(seconds: 1), (timer) {
      setState(() => _callSeconds++);
    });
  }

  void _endCall() {
    Vibration.cancel();
    _timer?.cancel();
    context.pop();
  }

  @override
  void dispose() {
    Vibration.cancel();
    _timer?.cancel();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFF1C1C1E),
      body: SafeArea(
        child: Column(
          children: [
            const SizedBox(height: 60),
            const CircleAvatar(
              radius: 54,
              backgroundColor: Colors.grey,
              child: Icon(Icons.person, size: 70, color: Colors.white),
            ),
            const SizedBox(height: 20),
            const Text(
              'Mom',
              style: TextStyle(fontSize: 32, fontWeight: FontWeight.bold, color: Colors.white),
            ),
            const SizedBox(height: 8),
            Text(
              _isAnswered
                  ? '${(_callSeconds ~/ 60).toString().padLeft(2, '0')}:${(_callSeconds % 60).toString().padLeft(2, '0')}'
                  : 'Incoming Call...',
              style: TextStyle(fontSize: 16, color: Colors.grey.shade400),
            ),
            const Spacer(),
            if (!_isAnswered)
              Padding(
                padding: const EdgeInsets.symmetric(horizontal: 40, vertical: 40),
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    FloatingActionButton(
                      heroTag: 'decline',
                      backgroundColor: Colors.red,
                      onPressed: _endCall,
                      child: const Icon(Icons.call_end, color: Colors.white, size: 32),
                    ),
                    FloatingActionButton(
                      heroTag: 'answer',
                      backgroundColor: Colors.green,
                      onPressed: _answerCall,
                      child: const Icon(Icons.call, color: Colors.white, size: 32),
                    ),
                  ],
                ),
              )
            else
              Padding(
                padding: const EdgeInsets.only(bottom: 50),
                child: FloatingActionButton(
                  heroTag: 'hangup',
                  backgroundColor: Colors.red,
                  onPressed: _endCall,
                  child: const Icon(Icons.call_end, color: Colors.white, size: 32),
                ),
              ),
          ],
        ),
      ),
    );
  }
}
