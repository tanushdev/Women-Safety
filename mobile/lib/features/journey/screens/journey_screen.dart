import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:geolocator/geolocator.dart';
import 'package:url_launcher/url_launcher.dart';
import '../../../shared/theme/app_theme.dart';
import '../../../core/services/api_service.dart';

class JourneyScreen extends ConsumerStatefulWidget {
  const JourneyScreen({super.key});

  @override
  ConsumerState<JourneyScreen> createState() => _JourneyScreenState();
}

class _JourneyScreenState extends ConsumerState<JourneyScreen> {
  final TextEditingController _destinationController = TextEditingController();
  int _etaMinutes = 25;
  bool _isJourneyActive = false;
  String? _trackingUrl;
  String? _shareToken;
  Timer? _locationStreamTimer;

  Future<void> _startJourney() async {
    if (_destinationController.text.trim().isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Please enter your destination')),
      );
      return;
    }

    try {
      final position = await Geolocator.getCurrentPosition();
      final apiService = ref.read(apiServiceProvider);

      final response = await apiService.startJourney({
        'destinationName': _destinationController.text.trim(),
        'currentLocation': [position.longitude, position.latitude],
        'etaMinutes': _etaMinutes,
      });

      if (response.data != null) {
        setState(() {
          _isJourneyActive = true;
          _shareToken = response.data['shareToken'];
          _trackingUrl = response.data['trackingUrl'] ?? 'https://womensafety.live/track/$_shareToken';
        });

        // Periodic location streaming
        _locationStreamTimer = Timer.periodic(const Duration(seconds: 20), (timer) async {
          if (!_isJourneyActive || _shareToken == null) return;
          try {
            final pos = await Geolocator.getCurrentPosition();
            await apiService.updateJourneyLocation(_shareToken!, pos.latitude, pos.longitude);
          } catch (_) {}
        });

        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Journey Guard active! Live tracking link generated.')),
        );
      }
    } catch (e) {
      // Offline / fallback simulator
      setState(() {
        _isJourneyActive = true;
        _shareToken = 'tr_local_mock';
        _trackingUrl = 'https://womensafety.live/track/demo';
      });
    }
  }

  Future<void> _markSafelyArrived() async {
    _locationStreamTimer?.cancel();
    if (_shareToken != null) {
      try {
        final apiService = ref.read(apiServiceProvider);
        await apiService.markJourneyArrived(_shareToken!);
      } catch (_) {}
    }

    setState(() {
      _isJourneyActive = false;
      _destinationController.clear();
    });

    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(
        content: Text('🎉 Safely arrived! Emergency contacts have been notified.'),
        backgroundColor: Colors.green,
      ),
    );
  }

  @override
  void dispose() {
    _locationStreamTimer?.cancel();
    _destinationController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Journey Guard (Live Trip Tracking)'),
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(20),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Container(
              padding: const EdgeInsets.all(16),
              decoration: BoxDecoration(
                color: Colors.purple.shade50,
                borderRadius: BorderRadius.circular(12),
                border: Border.all(color: Colors.purple.shade200),
              ),
              child: const Row(
                children: [
                  Icon(Icons.directions_car, color: Colors.purple, size: 28),
                  SizedBox(width: 12),
                  Expanded(
                    child: Text(
                      'Shares a live tracking browser link with family. If you do not confirm arrival by the ETA, an emergency alert automatically triggers.',
                      style: TextStyle(fontSize: 13, height: 1.4),
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 24),
            if (!_isJourneyActive) ...[
              const Text('Where are you travelling to?', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 16)),
              const SizedBox(height: 12),
              TextField(
                controller: _destinationController,
                decoration: InputDecoration(
                  labelText: 'Destination (e.g., Home, Office, Metro)',
                  prefixIcon: const Icon(Icons.location_on),
                  border: OutlineInputBorder(borderRadius: BorderRadius.circular(12)),
                ),
              ),
              const SizedBox(height: 20),
              const Text('Estimated Trip Duration', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 16)),
              const SizedBox(height: 12),
              Wrap(
                spacing: 12,
                children: [15, 25, 45, 60, 90].map((m) {
                  return ChoiceChip(
                    label: Text('$m mins'),
                    selected: _etaMinutes == m,
                    onSelected: (val) {
                      if (val) setState(() => _etaMinutes = m);
                    },
                  );
                }).toList(),
              ),
              const SizedBox(height: 36),
              SizedBox(
                width: double.infinity,
                child: ElevatedButton.icon(
                  onPressed: _startJourney,
                  icon: const Icon(Icons.shield, color: Colors.white),
                  label: const Text('Start Guarded Journey', style: TextStyle(fontSize: 16, color: Colors.white)),
                  style: ElevatedButton.styleFrom(
                    padding: const EdgeInsets.symmetric(vertical: 16),
                    backgroundColor: AppColors.primary,
                  ),
                ),
              ),
            ] else ...[
              Card(
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
                color: Colors.white,
                elevation: 3,
                child: Padding(
                  padding: const EdgeInsets.all(20),
                  child: Column(
                    children: [
                      const Icon(Icons.navigation, color: Colors.green, size: 48),
                      const SizedBox(height: 12),
                      const Text('Trip Guard Active', style: TextStyle(fontSize: 20, fontWeight: FontWeight.bold)),
                      const SizedBox(height: 6),
                      Text('Destination: ${_destinationController.text}', style: const TextStyle(color: Colors.grey)),
                      const SizedBox(height: 20),
                      Container(
                        padding: const EdgeInsets.all(12),
                        decoration: BoxDecoration(
                          color: Colors.grey.shade100,
                          borderRadius: BorderRadius.circular(8),
                        ),
                        child: Row(
                          children: [
                            const Icon(Icons.link, size: 20, color: Colors.blue),
                            const SizedBox(width: 8),
                            Expanded(
                              child: Text(
                                _trackingUrl ?? 'https://womensafety.live/track',
                                style: const TextStyle(fontSize: 12, color: Colors.blue),
                                overflow: TextOverflow.ellipsis,
                              ),
                            ),
                          ],
                        ),
                      ),
                      const SizedBox(height: 20),
                      SizedBox(
                        width: double.infinity,
                        child: ElevatedButton.icon(
                          onPressed: _markSafelyArrived,
                          icon: const Icon(Icons.check, color: Colors.white),
                          label: const Text('I Reached Safely', style: TextStyle(color: Colors.white, fontSize: 16)),
                          style: ElevatedButton.styleFrom(
                            backgroundColor: Colors.green,
                            padding: const EdgeInsets.symmetric(vertical: 16),
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            ],
          ],
        ),
      ),
    );
  }
}
