import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:geolocator/geolocator.dart';
import 'package:url_launcher/url_launcher.dart';
import 'package:vibration/vibration.dart';
import '../../../core/services/sms_service.dart';
import '../../../shared/theme/app_theme.dart';
import '../../../core/services/api_service.dart';

class SosScreen extends ConsumerStatefulWidget {
  const SosScreen({super.key});

  @override
  ConsumerState<SosScreen> createState() => _SosScreenState();
}

class _SosScreenState extends ConsumerState<SosScreen> with SingleTickerProviderStateMixin {
  late AnimationController _pulseController;
  bool _isRecording = true;
  int _recordingSeconds = 0;
  final int _maxRecordingSeconds = 20;
  Position? _currentPosition;
  String? _sosId;
  Timer? _recordingTimer;
  Timer? _locationTimer;

  @override
  void initState() {
    super.initState();
    
    // Pulse animation for SOS indicator
    _pulseController = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 1000),
    )..repeat(reverse: true);

    // Start SOS sequence
    _startSOS();
  }

  Future<void> _startSOS() async {
    // Vibrate to indicate SOS is active
    if (await Vibration.hasVibrator() ?? false) {
      Vibration.vibrate(pattern: [500, 500, 500, 500, 500]);
    }

    // Get current location
    await _getCurrentLocation();

    // Start recording countdown
    _startRecordingTimer();

    // Start location updates
    _startLocationUpdates();

    // Trigger SOS API call
    await _triggerSOSApi();

    // Send SMS to emergency contacts
    await _sendEmergencySMS();
  }

  Future<void> _getCurrentLocation() async {
    try {
      // Check if location services are enabled
      bool serviceEnabled = await Geolocator.isLocationServiceEnabled();
      if (!serviceEnabled) {
        debugPrint('Location services are disabled');
      }

      LocationPermission permission = await Geolocator.checkPermission();
      if (permission == LocationPermission.denied) {
        permission = await Geolocator.requestPermission();
        if (permission == LocationPermission.denied) {
          debugPrint('Location permission denied');
          return;
        }
      }

      if (permission == LocationPermission.deniedForever) {
        debugPrint('Location permission permanently denied');
        return;
      }

      // Get current position with timeout
      _currentPosition = await Geolocator.getCurrentPosition(
        desiredAccuracy: LocationAccuracy.high,
      ).timeout(
        const Duration(seconds: 10),
        onTimeout: () async {
          // Fallback to last known position
          final lastPos = await Geolocator.getLastKnownPosition();
          if (lastPos != null) return lastPos;
          throw Exception('Location timeout');
        },
      );
      
      debugPrint('SOS Location acquired: ${_currentPosition?.latitude}, ${_currentPosition?.longitude}');
      setState(() {});
    } catch (e) {
      debugPrint('Error getting location: $e');
    }
  }

  void _startLocationUpdates() {
    _locationTimer = Timer.periodic(const Duration(seconds: 5), (_) async {
      await _getCurrentLocation();
      
      // Update location on backend for Admin Dashboard Live Tracking
      if (_sosId != null && _currentPosition != null) {
        try {
           final apiService = ref.read(apiServiceProvider);
           await apiService.updateSosLocation(
             _sosId!, 
             _currentPosition!.latitude, 
             _currentPosition!.longitude
           );
        } catch (e) {
          debugPrint('Error updating location: $e');
        }
      }
    });
  }

  void _startRecordingTimer() {
    _recordingTimer = Timer.periodic(const Duration(seconds: 1), (timer) {
      if (mounted && _isRecording && _recordingSeconds < _maxRecordingSeconds) {
        setState(() {
          _recordingSeconds++;
        });
      } else if (_recordingSeconds >= _maxRecordingSeconds) {
        timer.cancel();
        setState(() {
          _isRecording = false;
        });
        // Auto-share location after 20 seconds
        _autoShareLocation();
      }
    });
  }

  Future<void> _autoShareLocation() async {
    if (_currentPosition == null) return;
    
    final locationUrl = 'https://maps.google.com/?q=${_currentPosition!.latitude},${_currentPosition!.longitude}';
    final message = 'EMERGENCY ALERT!\n\nI need help immediately.\n\nMy Live Location: $locationUrl\n\nSent from Women Safety App';
    
    // Auto-open SMS with emergency contacts
    try {
      final apiService = ref.read(apiServiceProvider);
      final response = await apiService.getEmergencyContacts();
      final contacts = response.data as List<dynamic>? ?? [];
      
      if (contacts.isNotEmpty) {
        // Get first contact's phone to pre-fill
        final firstPhone = contacts.first['phone'] as String? ?? '';
        final smsUri = Uri.parse('sms:$firstPhone?body=${Uri.encodeComponent(message)}');
        if (await canLaunchUrl(smsUri)) {
          await launchUrl(smsUri);
        }
      } else {
        // Open WhatsApp as fallback
        final whatsappUri = Uri.parse('whatsapp://send?text=${Uri.encodeComponent(message)}');
        if (await canLaunchUrl(whatsappUri)) {
          await launchUrl(whatsappUri);
        }
      }
    } catch (e) {
      debugPrint('Error auto-sharing: $e');
      // Fallback: Try WhatsApp
      final whatsappUri = Uri.parse('https://wa.me/?text=${Uri.encodeComponent(message)}');
      if (await canLaunchUrl(whatsappUri)) {
        await launchUrl(whatsappUri, mode: LaunchMode.externalApplication);
      }
    }
  }

  Future<void> _triggerSOSApi() async {
    try {
      final apiService = ref.read(apiServiceProvider);
      final response = await apiService.triggerSOS({
        'location': _currentPosition != null
            ? {
                'latitude': _currentPosition!.latitude,
                'longitude': _currentPosition!.longitude,
              }
            : null,
        'triggeredAt': DateTime.now().toIso8601String(),
      });
      _sosId = response.data['data']?['id'];
    } catch (e) {
      debugPrint('Error triggering SOS: $e');
    }
  }

  Future<void> _sendEmergencySMS() async {
    if (_currentPosition == null) return;

    final locationUrl = 'https://maps.google.com/?q=${_currentPosition!.latitude},${_currentPosition!.longitude}';
    final message = 'EMERGENCY ALERT! I need help immediately.\n\nMy Location: $locationUrl\n\nSent from Women Safety App';
    
    try {
      final apiService = ref.read(apiServiceProvider);
      final response = await apiService.getEmergencyContacts();
      final contacts = response.data as List<dynamic>? ?? [];
      
      if (contacts.isEmpty) {
        debugPrint('No emergency contacts found');
        _showNoContactsWarning();
        return;
      }

      debugPrint('Sending emergency SMS to ${contacts.length} contacts...');
      
      List<String> validPhones = [];
      for (final contact in contacts) {
        final phone = contact['phone'] as String?;
        if (phone != null && phone.isNotEmpty) {
           validPhones.add(phone);
        }
      }

      if (validPhones.isNotEmpty) {
        // Use SMSService to send SMS directly (background, no user interaction)
        await SMSService().sendSOSMessages(validPhones, message);
      }
      
    } catch (e) {
      debugPrint('Error sending emergency SMS: $e');
    }
  }

  void _showNoContactsWarning() {
    if (mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: const Text('No emergency contacts! Add contacts in Profile.'),
          backgroundColor: Colors.orange,
          action: SnackBarAction(
            label: 'Add',
            textColor: Colors.white,
            onPressed: () => context.push('/contacts'),
          ),
        ),
      );
    }
  }

  Future<void> _shareViaWhatsApp(String phone) async {
    if (_currentPosition == null) return;
    
    final locationUrl = 'https://maps.google.com/?q=${_currentPosition!.latitude},${_currentPosition!.longitude}';
    final message = 'EMERGENCY! I need help immediately.\n\nMy live location: $locationUrl\n\nSent from Women Safety App';
    
    // Clean phone number
    final cleanPhone = phone.replaceAll(RegExp(r'[^0-9+]'), '');
    
    try {
      final whatsappUri = Uri.parse('https://wa.me/$cleanPhone?text=${Uri.encodeComponent(message)}');
      if (await canLaunchUrl(whatsappUri)) {
        await launchUrl(whatsappUri, mode: LaunchMode.externalApplication);
      }
    } catch (e) {
      debugPrint('Error sharing via WhatsApp: $e');
    }
  }

  Future<void> _callEmergency() async {
    final uri = Uri.parse('tel:112');
    if (await canLaunchUrl(uri)) {
      await launchUrl(uri);
    }
  }

  Future<void> _shareLocation() async {
    if (_currentPosition == null) return;

    final locationUrl = 'https://maps.google.com/?q=${_currentPosition!.latitude},${_currentPosition!.longitude}';
    final message = 'EMERGENCY! I need help.\n\nMy Location: $locationUrl\n\nSent from Women Safety App';

    // Show sharing options
    await showModalBottomSheet(
      context: context,
      backgroundColor: Colors.white,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (context) => SafeArea(
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              const Text(
                'Share Location',
                style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold),
              ),
              const SizedBox(height: 16),
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceEvenly,
                children: [
                  _buildShareOption(
                    icon: Icons.message,
                    label: 'SMS',
                    color: Colors.blue,
                    onTap: () async {
                      Navigator.pop(context);
                      final smsUri = Uri.parse('sms:?body=${Uri.encodeComponent(message)}');
                      if (await canLaunchUrl(smsUri)) {
                        await launchUrl(smsUri);
                      }
                    },
                  ),
                  _buildShareOption(
                    icon: Icons.chat,
                    label: 'WhatsApp',
                    color: Colors.green,
                    onTap: () async {
                      Navigator.pop(context);
                      final whatsappUri = Uri.parse('whatsapp://send?text=${Uri.encodeComponent(message)}');
                      if (await canLaunchUrl(whatsappUri)) {
                        await launchUrl(whatsappUri);
                      } else {
                        // Fallback to web WhatsApp
                        final webUri = Uri.parse('https://wa.me/?text=${Uri.encodeComponent(message)}');
                        await launchUrl(webUri, mode: LaunchMode.externalApplication);
                      }
                    },
                  ),
                  _buildShareOption(
                    icon: Icons.map,
                    label: 'Maps',
                    color: Colors.red,
                    onTap: () async {
                      Navigator.pop(context);
                      final mapUri = Uri.parse(locationUrl);
                      if (await canLaunchUrl(mapUri)) {
                        await launchUrl(mapUri, mode: LaunchMode.externalApplication);
                      }
                    },
                  ),
                  _buildShareOption(
                    icon: Icons.share,
                    label: 'More',
                    color: Colors.orange,
                    onTap: () async {
                      Navigator.pop(context);
                      // Use system share sheet
                      final shareUri = Uri.parse('share:?text=${Uri.encodeComponent(message)}');
                      await launchUrl(shareUri);
                    },
                  ),
                ],
              ),
              const SizedBox(height: 16),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildShareOption({
    required IconData icon,
    required String label,
    required Color color,
    required VoidCallback onTap,
  }) {
    return InkWell(
      onTap: onTap,
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Container(
            padding: const EdgeInsets.all(14),
            decoration: BoxDecoration(
              color: color.withOpacity(0.1),
              shape: BoxShape.circle,
            ),
            child: Icon(icon, color: color, size: 28),
          ),
          const SizedBox(height: 8),
          Text(label, style: const TextStyle(fontSize: 12)),
        ],
      ),
    );
  }

  @override
  void dispose() {
    _pulseController.dispose();
    _recordingTimer?.cancel();
    _locationTimer?.cancel();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.sosActive,
      appBar: AppBar(
        backgroundColor: AppColors.sosActive,
        foregroundColor: Colors.white,
        title: const Text('SOS ACTIVE'),
        elevation: 0,
        automaticallyImplyLeading: false,
      ),
      body: SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.all(20.0),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              const SizedBox(height: 10),

              // Pulsing SOS Indicator - smaller size
              AnimatedBuilder(
                animation: _pulseController,
                builder: (context, child) {
                  return Container(
                    width: 100 + (30 * _pulseController.value),
                    height: 100 + (30 * _pulseController.value),
                    decoration: BoxDecoration(
                      shape: BoxShape.circle,
                      color: Color.fromRGBO(255, 255, 255, 0.9),
                      boxShadow: [
                        BoxShadow(
                          color: Color.fromRGBO(255, 255, 255, 0.5),
                          blurRadius: 30,
                          spreadRadius: 10,
                        ),
                      ],
                    ),
                    child: const Center(
                      child: Icon(
                        Icons.warning_rounded,
                        size: 50,
                        color: AppColors.sosActive,
                      ),
                    ),
                  );
                },
              ),

              const SizedBox(height: 20),

              // Status Text
              const Text(
                'Emergency Alert Sent',
                style: TextStyle(
                  color: Colors.white,
                  fontSize: 20,
                  fontWeight: FontWeight.bold,
                ),
                textAlign: TextAlign.center,
              ),

              const SizedBox(height: 8),

              // Location display
              if (_currentPosition != null)
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                  decoration: BoxDecoration(
                    color: Color.fromRGBO(255, 255, 255, 0.2),
                    borderRadius: BorderRadius.circular(16),
                  ),
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      const Icon(Icons.location_on, color: Colors.white, size: 14),
                      const SizedBox(width: 4),
                      Text(
                        '${_currentPosition!.latitude.toStringAsFixed(4)}, ${_currentPosition!.longitude.toStringAsFixed(4)}',
                        style: const TextStyle(
                          color: Colors.white,
                          fontSize: 11,
                        ),
                      ),
                    ],
                  ),
                ),

              const SizedBox(height: 10),

              // Recording Indicator
              if (_isRecording)
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                  decoration: BoxDecoration(
                    color: Color.fromRGBO(255, 255, 255, 0.2),
                    borderRadius: BorderRadius.circular(16),
                  ),
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Container(
                        width: 10,
                        height: 10,
                        decoration: const BoxDecoration(
                          color: Colors.red,
                          shape: BoxShape.circle,
                        ),
                      ),
                      const SizedBox(width: 6),
                      Text(
                        'Recording ${_maxRecordingSeconds - _recordingSeconds}s',
                        style: const TextStyle(
                          color: Colors.white,
                          fontSize: 12,
                        ),
                      ),
                    ],
                  ),
                ),

              const SizedBox(height: 16),

              // Status Items - Compact
              _buildStatusItem(
                icon: Icons.message,
                text: 'SMS sent to contacts',
                isComplete: true,
              ),
              const SizedBox(height: 8),
              _buildStatusItem(
                icon: Icons.location_on,
                text: 'Live location active',
                isComplete: _currentPosition != null,
              ),
              const SizedBox(height: 8),
              _buildStatusItem(
                icon: Icons.people,
                text: 'Volunteers notified',
                isComplete: true,
              ),
              const SizedBox(height: 8),
              _buildStatusItem(
                icon: Icons.local_police,
                text: 'Police alerted',
                isComplete: true,
              ),

              const SizedBox(height: 20),

              // Quick Actions
              Row(
                children: [
                  Expanded(
                    child: ElevatedButton.icon(
                      onPressed: _callEmergency,
                      icon: const Icon(Icons.phone, color: Colors.white, size: 18),
                      label: const Text('Call 112', style: TextStyle(color: Colors.white, fontSize: 13)),
                      style: ElevatedButton.styleFrom(
                        backgroundColor: Colors.green,
                        padding: const EdgeInsets.symmetric(vertical: 10),
                      ),
                    ),
                  ),
                  const SizedBox(width: 10),
                  Expanded(
                    child: ElevatedButton.icon(
                      onPressed: _shareLocation,
                      icon: const Icon(Icons.share, color: Colors.white, size: 18),
                      label: const Text('Share', style: TextStyle(color: Colors.white, fontSize: 13)),
                      style: ElevatedButton.styleFrom(
                        backgroundColor: Colors.blue,
                        padding: const EdgeInsets.symmetric(vertical: 10),
                      ),
                    ),
                  ),
                ],
              ),

              const SizedBox(height: 12),

              // Cancel Button
              SizedBox(
                width: double.infinity,
                child: ElevatedButton(
                  onPressed: () {
                    _showCancelDialog(context);
                  },
                  style: ElevatedButton.styleFrom(
                    backgroundColor: Colors.white,
                    foregroundColor: AppColors.sosActive,
                    padding: const EdgeInsets.symmetric(vertical: 14),
                  ),
                  child: const Text(
                    'I\'m Safe - Cancel SOS',
                    style: TextStyle(
                      fontSize: 14,
                      fontWeight: FontWeight.bold,
                    ),
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildStatusItem({
    required IconData icon,
    required String text,
    required bool isComplete,
  }) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
      decoration: BoxDecoration(
        color: Color.fromRGBO(255, 255, 255, 0.1),
        borderRadius: BorderRadius.circular(10),
        border: Border.all(
          color: Color.fromRGBO(255, 255, 255, 0.3),
        ),
      ),
      child: Row(
        children: [
          Container(
            padding: const EdgeInsets.all(6),
            decoration: const BoxDecoration(
              color: Colors.white,
              shape: BoxShape.circle,
            ),
            child: Icon(
              icon,
              color: AppColors.sosActive,
              size: 14,
            ),
          ),
          const SizedBox(width: 10),
          Expanded(
            child: Text(
              text,
              style: const TextStyle(
                color: Colors.white,
                fontSize: 12,
              ),
            ),
          ),
          Icon(
            isComplete ? Icons.check_circle : Icons.hourglass_empty,
            color: Colors.white,
            size: 16,
          ),
        ],
      ),
    );
  }

  void _showCancelDialog(BuildContext context) {
    showDialog(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Cancel SOS Alert?'),
        content: const Text(
          'Are you sure you want to cancel this emergency alert? This will notify your contacts that you are safe.',
        ),
        actions: [
          TextButton(
            onPressed: () {
              Navigator.pop(context);
            },
            child: const Text('No, Keep Active'),
          ),
          ElevatedButton(
            onPressed: () async {
              // Cancel SOS via API
              if (_sosId != null) {
                try {
                  final apiService = ref.read(apiServiceProvider);
                  await apiService.cancelSOS(_sosId!);
                } catch (e) {
                  debugPrint('Error cancelling SOS: $e');
                }
              }

              // Stop vibration
              Vibration.cancel();

              Navigator.pop(context);
              context.go('/home');
            },
            style: ElevatedButton.styleFrom(
              backgroundColor: AppColors.safe,
            ),
            child: const Text('Yes, I\'m Safe'),
          ),
        ],
      ),
    );
  }
}
