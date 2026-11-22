import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import '../../../shared/theme/app_theme.dart';

class CalcScreen extends StatefulWidget {
  const CalcScreen({super.key});

  @override
  State<CalcScreen> createState() => _CalcScreenState();
}

class _CalcScreenState extends State<CalcScreen> {
  String _input = '0';
  final String _secretCode = '9999';

  void _onKeyPress(String key) {
    setState(() {
      if (key == 'C') {
        _input = '0';
      } else if (key == '=') {
        if (_input == _secretCode) {
          // Secret SOS Triggered!
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(
              content: Text('🤫 Stealth SOS Triggered!'),
              backgroundColor: AppColors.danger,
            ),
          );
          context.push('/sos');
        } else {
          // Dummy calculation
          _input = '42';
        }
      } else {
        if (_input == '0') {
          _input = key;
        } else {
          _input += key;
        }
      }
    });
  }

  @override
  Widget build(BuildContext context) {
    final keys = [
      ['C', '+/-', '%', '/'],
      ['7', '8', '9', 'x'],
      ['4', '5', '6', '-'],
      ['1', '2', '3', '+'],
      ['0', '.', '=', ''],
    ];

    return Scaffold(
      backgroundColor: Colors.black,
      appBar: AppBar(
        backgroundColor: Colors.black,
        elevation: 0,
        title: const Text('Calculator', style: TextStyle(color: Colors.white)),
        leading: IconButton(
          icon: const Icon(Icons.arrow_back, color: Colors.white),
          onPressed: () => context.pop(),
        ),
      ),
      body: Column(
        children: [
          Expanded(
            child: Container(
              alignment: Alignment.bottomRight,
              padding: const EdgeInsets.all(24),
              child: Text(
                _input,
                style: const TextStyle(fontSize: 52, color: Colors.white, fontWeight: FontWeight.w300),
              ),
            ),
          ),
          ...keys.map((row) {
            return Row(
              children: row.map((key) {
                if (key.isEmpty) return const Expanded(child: SizedBox());
                final isOp = ['/', 'x', '-', '+', '='].contains(key);
                return Expanded(
                  child: Padding(
                    padding: const EdgeInsets.all(6),
                    child: InkWell(
                      onTap: () => _onKeyPress(key),
                      borderRadius: BorderRadius.circular(50),
                      child: Container(
                        height: 70,
                        decoration: BoxDecoration(
                          shape: BoxShape.circle,
                          color: isOp ? Colors.orange : Colors.grey.shade800,
                        ),
                        child: Center(
                          child: Text(
                            key,
                            style: const TextStyle(fontSize: 26, color: Colors.white, fontWeight: FontWeight.bold),
                          ),
                        ),
                      ),
                    ),
                  ),
                );
              }).toList(),
            );
          }).toList(),
          const SizedBox(height: 20),
        ],
      ),
    );
  }
}
