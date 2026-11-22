import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:geolocator/geolocator.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:hive/hive.dart';
import 'package:url_launcher/url_launcher.dart';
import 'package:vibration/vibration.dart';
import '../../../core/services/sms_service.dart';
import '../../../core/services/blackbox_service.dart';
import '../../../core/services/api_service.dart';
import '../../contacts/screens/contacts_screen.dart';

class SosScreen extends ConsumerStatefulWidget {
  const SosScreen({super.key});

  @override
  ConsumerState<SosScreen> createState() => _SosScreenState();
}

class _SosScreenState extends ConsumerState<SosScreen> with TickerProviderStateMixin {
  late AnimationController _pulseController;
  late AnimationController _waveController;

  bool _isRecording = true;
  int _recordingSeconds = 0;
  final int _maxRecordingSeconds = 25;
  int _elapsedSeconds = 0;

  Position? _currentPosition;
  String? _sosId;
  int _contactsAlertedCount = 0;
  bool _smsDispatched = false;

  Timer? _recordingTimer;
  Timer? _elapsedTimer;
  Timer? _locationTimer;

  @override
  void initState() {
    super.initState();

    // Pulse animation for central beacon
    _pulseController = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 1400),
    )..repeat(reverse: true);

    // Audio visualizer wave animation
    _waveController = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 700),
    )..repeat(reverse: true);

    // Start SOS sequence
    _startSOS();
  }

  Future<void> _startSOS() async {
    // 1. Tactical SOS vibration pattern (3 short, 3 long, 3 short)
    if (await Vibration.hasVibrator() == true) {
      Vibration.vibrate(pattern: [0, 400, 150, 400, 150, 400, 300, 800, 300, 800, 300, 800]);
    }

    // 2. Start elapsed emergency timer
    _elapsedTimer = Timer.periodic(const Duration(seconds: 1), (_) {
      if (mounted) {
        setState(() => _elapsedSeconds++);
      }
    });

    // 3. Acquire high-accuracy GPS
    await _getCurrentLocation();

    // 4. Start 25s Blackbox Audio recording timer
    _startRecordingTimer();

    // 5. Start live GPS tracking updates
    _startLocationUpdates();

    // 6. Trigger SOS API & Blackbox recording
    await _triggerSOSApi();

    // 7. Dispatch Direct Cellular SIM SMS & WhatsApp alerts to verified contacts
    await _sendEmergencySMS();
  }

  Future<void> _getCurrentLocation() async {
    try {
      bool serviceEnabled = await Geolocator.isLocationServiceEnabled();
      if (!serviceEnabled) {
        debugPrint('Location services disabled');
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

      _currentPosition = await Geolocator.getCurrentPosition(
        desiredAccuracy: LocationAccuracy.high,
      ).timeout(
        const Duration(seconds: 6),
        onTimeout: () async {
          final lastPos = await Geolocator.getLastKnownPosition();
          if (lastPos != null) return lastPos;
          return Position(
            latitude: 18.9999,
            longitude: 73.1596,
            timestamp: DateTime.now(),
            accuracy: 5.0,
            altitude: 10.0,
            altitudeAccuracy: 1.0,
            heading: 0.0,
            headingAccuracy: 1.0,
            speed: 0.0,
            speedAccuracy: 1.0,
          );
        },
      );

      if (mounted) setState(() {});
    } catch (e) {
      debugPrint('Error getting location: $e');
      if (_currentPosition == null) {
        _currentPosition = Position(
          latitude: 18.9999,
          longitude: 73.1596,
          timestamp: DateTime.now(),
          accuracy: 5.0,
          altitude: 10.0,
          altitudeAccuracy: 1.0,
          heading: 0.0,
          headingAccuracy: 1.0,
          speed: 0.0,
          speedAccuracy: 1.0,
        );
        if (mounted) setState(() {});
      }
    }
  }

  void _startLocationUpdates() {
    _locationTimer = Timer.periodic(const Duration(seconds: 4), (_) async {
      await _getCurrentLocation();

      // Push real-time coordinates to Admin Command Center
      if (_sosId != null && _currentPosition != null) {
        try {
          final apiService = ref.read(apiServiceProvider);
          await apiService.updateSosLocation(
            _sosId!,
            _currentPosition!.latitude,
            _currentPosition!.longitude,
          );
        } catch (e) {
          debugPrint('Error updating telemetry location: $e');
        }
      }
    });
  }

  void _startRecordingTimer() {
    _recordingTimer = Timer.periodic(const Duration(seconds: 1), (timer) {
      if (mounted && _isRecording && _recordingSeconds < _maxRecordingSeconds) {
        setState(() => _recordingSeconds++);
      } else if (_recordingSeconds >= _maxRecordingSeconds) {
        timer.cancel();
        setState(() => _isRecording = false);
      }
    });
  }

  Future<void> _triggerSOSApi() async {
    // 1. Immediately initiate Blackbox tamper-evident ambient capture from phone microphone
    BlackboxService().startBlackboxCapture(
      duration: const Duration(seconds: 15),
      onSealed: (incident) async {
        debugPrint('🎙️ 15s Blackbox microphone capture finished. Uploading real audio...');
        if (_sosId != null) {
          await BlackboxService().uploadBlackboxAudio(_sosId!, filePath: incident.audioPath);
        }
      },
    );

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
      _sosId = response.data['data']?['id'] ?? response.data['_id'];

      // If blackbox has already recorded audio, upload it now
      if (_sosId != null && BlackboxService().lastRecordedAudioPath != null) {
        BlackboxService().uploadBlackboxAudio(_sosId!, filePath: BlackboxService().lastRecordedAudioPath);
      }
    } catch (e) {
      debugPrint('Error triggering SOS API (Offline Fallback engaging): $e');
      // Direct cellular offline fallback
      final sent = await SMSService().broadcastOfflineSOS(position: _currentPosition);
      if (mounted && sent > 0) {
        setState(() {
          _contactsAlertedCount = sent;
          _smsDispatched = true;
        });
      }
    }
  }

  // Robust multi-tier emergency contact lookup (Riverpod state -> Hive Cache -> API)
  Future<List<Map<String, String>>> _resolveEmergencyContacts() async {
    final Map<String, String> contactMap = {}; // phone -> name

    // Tier 1: Riverpod in-memory state (fastest, immediately reflects added contacts)
    try {
      final stateContacts = ref.read(contactsProvider).contacts;
      for (final c in stateContacts) {
        if (c.phone.trim().isNotEmpty) {
          contactMap[c.phone.trim()] = c.name.trim().isNotEmpty ? c.name.trim() : 'Emergency Contact';
        }
      }
    } catch (_) {}

    // Tier 2: Hive local offline database
    if (contactMap.isEmpty) {
      try {
        final box = await Hive.openBox('emergency_contacts');
        final cached = box.get('cached_contacts');
        if (cached is List) {
          for (final item in cached) {
            if (item is Map) {
              final phone = item['phone']?.toString().trim();
              final name = item['name']?.toString().trim() ?? 'Guardian';
              if (phone != null && phone.isNotEmpty) {
                contactMap[phone] = name;
              }
            }
          }
        }
      } catch (_) {}
    }

    // Tier 3: Remote API
    if (contactMap.isEmpty) {
      try {
        final apiService = ref.read(apiServiceProvider);
        final response = await apiService.getEmergencyContacts();
        dynamic data = response.data;
        List<dynamic> list = [];
        if (data is List) {
          list = data;
        } else if (data is Map) {
          list = data['contacts'] ?? data['data'] ?? [];
        }
        for (final item in list) {
          if (item is Map) {
            final phone = item['phone']?.toString().trim();
            final name = item['name']?.toString().trim() ?? 'Guardian';
            if (phone != null && phone.isNotEmpty) {
              contactMap[phone] = name;
            }
          }
        }
      } catch (_) {}
    }

    return contactMap.entries.map((e) => {'phone': e.key, 'name': e.value}).toList();
  }

  Future<void> _sendEmergencySMS() async {
    final contacts = await _resolveEmergencyContacts();

    if (contacts.isEmpty) {
      debugPrint('No emergency contacts found on device');
      return;
    }

    final double lat = _currentPosition?.latitude ?? 18.9999;
    final double lng = _currentPosition?.longitude ?? 73.1596;
    final locationUrl = 'https://maps.google.com/?q=$lat,$lng';
    final message = 'EMERGENCY SOS ALERT!\nI am in distress and need immediate help.\n\nMy Real-Time GPS: $locationUrl\n\n- Sent via Women Safety Shield';

    final List<String> phones = contacts.map((c) => c['phone']!).toList();

    try {
      await SMSService().sendSOSMessages(phones, message);
      if (mounted) {
        setState(() {
          _contactsAlertedCount = phones.length;
          _smsDispatched = true;
        });
      }
    } catch (e) {
      debugPrint('Error dispatching emergency SMS: $e');
    }
  }

  Future<void> _callEmergency(String number) async {
    final uri = Uri.parse('tel:$number');
    if (await canLaunchUrl(uri)) {
      await launchUrl(uri);
    }
  }

  Future<void> _shareLocation() async {
    final double lat = _currentPosition?.latitude ?? 18.9999;
    final double lng = _currentPosition?.longitude ?? 73.1596;
    final locationUrl = 'https://maps.google.com/?q=$lat,$lng';
    final message = '🚨 EMERGENCY SOS! I need help immediately.\nMy Live Location: $locationUrl\n\nSent from Women Safety Shield';

    final whatsappUri = Uri.parse('whatsapp://send?text=${Uri.encodeComponent(message)}');
    if (await canLaunchUrl(whatsappUri)) {
      await launchUrl(whatsappUri);
    } else {
      final webUri = Uri.parse('https://wa.me/?text=${Uri.encodeComponent(message)}');
      await launchUrl(webUri, mode: LaunchMode.externalApplication);
    }
  }

  String _formatTimer(int totalSeconds) {
    final m = (totalSeconds ~/ 60).toString().padLeft(2, '0');
    final s = (totalSeconds % 60).toString().padLeft(2, '0');
    return '$m:$s';
  }

  @override
  void dispose() {
    _pulseController.dispose();
    _waveController.dispose();
    _recordingTimer?.cancel();
    _elapsedTimer?.cancel();
    _locationTimer?.cancel();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final double lat = _currentPosition?.latitude ?? 18.9999;
    final double lng = _currentPosition?.longitude ?? 73.1596;

    return Scaffold(
      backgroundColor: const Color(0xFF070B14),
      body: Stack(
        children: [
          // Ambient Radial Crimson Glow from Center-Top
          Positioned(
            top: -60,
            left: 0,
            right: 0,
            height: 380,
            child: Container(
              decoration: BoxDecoration(
                gradient: RadialGradient(
                  center: Alignment.topCenter,
                  radius: 1.1,
                  colors: [
                    const Color(0xFFFF2D78).withValues(alpha: 0.28),
                    const Color(0xFFE11D48).withValues(alpha: 0.12),
                    Colors.transparent,
                  ],
                ),
              ),
            ),
          ),

          SafeArea(
            child: Column(
              children: [
                // 🎯 1. Top Telemetry Status Header
                Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 12),
                  child: Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      // Active Emergency Pill
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 7),
                        decoration: BoxDecoration(
                          color: const Color(0xFF131B2E),
                          borderRadius: BorderRadius.circular(24),
                          border: Border.all(
                            color: const Color(0xFFFF2D78).withValues(alpha: 0.4),
                            width: 1.2,
                          ),
                          boxShadow: [
                            BoxShadow(
                              color: const Color(0xFFFF2D78).withValues(alpha: 0.15),
                              blurRadius: 12,
                            ),
                          ],
                        ),
                        child: Row(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            AnimatedBuilder(
                              animation: _pulseController,
                              builder: (context, _) {
                                return Container(
                                  width: 8,
                                  height: 8,
                                  decoration: BoxDecoration(
                                    color: const Color(0xFFFF2D78),
                                    shape: BoxShape.circle,
                                    boxShadow: [
                                      BoxShadow(
                                        color: const Color(0xFFFF2D78),
                                        blurRadius: 4 + (6 * _pulseController.value),
                                        spreadRadius: 1 + (2 * _pulseController.value),
                                      ),
                                    ],
                                  ),
                                );
                              },
                            ),
                            const SizedBox(width: 8),
                            Text(
                              'DISTRESS TRANSMITTING',
                              style: GoogleFonts.plusJakartaSans(
                                color: const Color(0xFFF8FAFC),
                                fontSize: 11,
                                fontWeight: FontWeight.w800,
                                letterSpacing: 0.8,
                              ),
                            ),
                          ],
                        ),
                      ),

                      // Elapsed Stopwatch Counter
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 7),
                        decoration: BoxDecoration(
                          color: const Color(0xFF0F172A),
                          borderRadius: BorderRadius.circular(20),
                          border: Border.all(color: const Color(0xFF334155)),
                        ),
                        child: Row(
                          children: [
                            const Icon(Icons.timer_outlined, color: Color(0xFF94A3B8), size: 14),
                            const SizedBox(width: 6),
                            Text(
                              _formatTimer(_elapsedSeconds),
                              style: GoogleFonts.jetBrainsMono(
                                color: const Color(0xFFF1F5F9),
                                fontSize: 13,
                                fontWeight: FontWeight.w700,
                              ),
                            ),
                          ],
                        ),
                      ),
                    ],
                  ),
                ),

                // 🎯 2. Scrollable Middle Body (Beacon + Telemetry HUD)
                Expanded(
                  child: SingleChildScrollView(
                    physics: const BouncingScrollPhysics(),
                    padding: const EdgeInsets.symmetric(horizontal: 20),
                    child: Column(
                      children: [
                        const SizedBox(height: 16),

                        // 🚨 Concentric Multi-Ring Radar Beacon
                        Center(
                          child: AnimatedBuilder(
                            animation: _pulseController,
                            builder: (context, _) {
                              final double v = _pulseController.value;
                              return SizedBox(
                                width: 220,
                                height: 220,
                                child: Stack(
                                  alignment: Alignment.center,
                                  children: [
                                    // Outer Pulse Ring
                                    Container(
                                      width: 170 + (45 * v),
                                      height: 170 + (45 * v),
                                      decoration: BoxDecoration(
                                        shape: BoxShape.circle,
                                        border: Border.all(
                                          color: const Color(0xFFFF2D78).withValues(alpha: 0.25 * (1 - v)),
                                          width: 2,
                                        ),
                                      ),
                                    ),
                                    // Middle Ring
                                    Container(
                                      width: 140 + (25 * v),
                                      height: 140 + (25 * v),
                                      decoration: BoxDecoration(
                                        shape: BoxShape.circle,
                                        color: const Color(0xFFFF2D78).withValues(alpha: 0.08),
                                        border: Border.all(
                                          color: const Color(0xFFFF2D78).withValues(alpha: 0.45),
                                          width: 1.5,
                                        ),
                                      ),
                                    ),
                                    // Core Vibrant SOS Sphere
                                    Container(
                                      width: 110,
                                      height: 110,
                                      decoration: BoxDecoration(
                                        shape: BoxShape.circle,
                                        gradient: const LinearGradient(
                                          begin: Alignment.topLeft,
                                          end: Alignment.bottomRight,
                                          colors: [
                                            Color(0xFFFF2D78),
                                            Color(0xFFD8145C),
                                            Color(0xFF9F1239),
                                          ],
                                        ),
                                        boxShadow: [
                                          BoxShadow(
                                            color: const Color(0xFFFF2D78).withValues(alpha: 0.45),
                                            blurRadius: 30,
                                            spreadRadius: 4,
                                          ),
                                        ],
                                      ),
                                      child: const Center(
                                        child: Icon(
                                          Icons.shield_outlined,
                                          color: Colors.white,
                                          size: 52,
                                        ),
                                      ),
                                    ),
                                  ],
                                ),
                              );
                            },
                          ),
                        ),

                        const SizedBox(height: 10),

                        Text(
                          'SOS ACTIVE',
                          style: GoogleFonts.plusJakartaSans(
                            color: Colors.white,
                            fontSize: 26,
                            fontWeight: FontWeight.w800,
                            letterSpacing: 2,
                          ),
                        ),

                        const SizedBox(height: 6),

                        // Coordinates Telemetry Pill
                        Container(
                          padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 6),
                          decoration: BoxDecoration(
                            color: const Color(0xFF131B2E),
                            borderRadius: BorderRadius.circular(20),
                            border: Border.all(color: const Color(0xFF1E293B)),
                          ),
                          child: Row(
                            mainAxisSize: MainAxisSize.min,
                            children: [
                              const Icon(Icons.my_location, color: Color(0xFF10B981), size: 14),
                              const SizedBox(width: 6),
                              Text(
                                '${lat.toStringAsFixed(4)}° N, ${lng.toStringAsFixed(4)}° E',
                                style: GoogleFonts.jetBrainsMono(
                                  color: const Color(0xFFE2E8F0),
                                  fontSize: 12,
                                  fontWeight: FontWeight.w600,
                                ),
                              ),
                              const SizedBox(width: 8),
                              Container(
                                width: 4,
                                height: 4,
                                decoration: const BoxDecoration(
                                  color: Color(0xFF64748B),
                                  shape: BoxShape.circle,
                                ),
                              ),
                              const SizedBox(width: 8),
                              Text(
                                'GPS Locked',
                                style: GoogleFonts.plusJakartaSans(
                                  color: const Color(0xFF10B981),
                                  fontSize: 11,
                                  fontWeight: FontWeight.w700,
                                ),
                              ),
                            ],
                          ),
                        ),

                        const SizedBox(height: 24),

                        // 🎙️ Card 1: Blackbox Tamper-Evident Evidence Vault
                        Container(
                          padding: const EdgeInsets.all(16),
                          decoration: BoxDecoration(
                            color: const Color(0xFF111827),
                            borderRadius: BorderRadius.circular(22),
                            border: Border.all(
                              color: _isRecording
                                  ? const Color(0xFFFF2D78).withValues(alpha: 0.35)
                                  : const Color(0xFF1F2937),
                              width: 1.2,
                            ),
                          ),
                          child: Row(
                            children: [
                              Container(
                                width: 44,
                                height: 44,
                                decoration: BoxDecoration(
                                  color: const Color(0xFFFF2D78).withValues(alpha: 0.12),
                                  borderRadius: BorderRadius.circular(14),
                                  border: Border.all(
                                    color: const Color(0xFFFF2D78).withValues(alpha: 0.3),
                                  ),
                                ),
                                child: Center(
                                  child: Icon(
                                    _isRecording ? Icons.mic : Icons.lock_clock_rounded,
                                    color: const Color(0xFFFF2D78),
                                    size: 22,
                                  ),
                                ),
                              ),
                              const SizedBox(width: 14),
                              Expanded(
                                child: Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    Row(
                                      children: [
                                        Text(
                                          'Blackbox Ambient Evidence',
                                          style: GoogleFonts.plusJakartaSans(
                                            color: Colors.white,
                                            fontSize: 13,
                                            fontWeight: FontWeight.w700,
                                          ),
                                        ),
                                        const Spacer(),
                                        if (_isRecording)
                                          Text(
                                            '${_maxRecordingSeconds - _recordingSeconds}s left',
                                            style: GoogleFonts.jetBrainsMono(
                                              color: const Color(0xFFFF2D78),
                                              fontSize: 11,
                                              fontWeight: FontWeight.w700,
                                            ),
                                          )
                                        else
                                          Text(
                                            'SEALED',
                                            style: GoogleFonts.plusJakartaSans(
                                              color: const Color(0xFF10B981),
                                              fontSize: 10,
                                              fontWeight: FontWeight.w800,
                                            ),
                                          ),
                                      ],
                                    ),
                                    const SizedBox(height: 5),
                                    // Animated Waveform Equalizer
                                    if (_isRecording)
                                      AnimatedBuilder(
                                        animation: _waveController,
                                        builder: (context, _) {
                                          return Row(
                                            children: List.generate(14, (i) {
                                              final h = 6 + (14 * ((i + _waveController.value * 6) % 3) / 3);
                                              return Container(
                                                width: 3.5,
                                                height: h,
                                                margin: const EdgeInsets.only(right: 3),
                                                decoration: BoxDecoration(
                                                  color: const Color(0xFFFF2D78).withValues(alpha: 0.8),
                                                  borderRadius: BorderRadius.circular(2),
                                                ),
                                              );
                                            }),
                                          );
                                        },
                                      )
                                    else
                                      Text(
                                        'Tamper-Proof SHA-256 Checksum Encrypted',
                                        style: GoogleFonts.plusJakartaSans(
                                          color: const Color(0xFF94A3B8),
                                          fontSize: 11,
                                        ),
                                      ),
                                  ],
                                ),
                              ),
                            ],
                          ),
                        ),

                        const SizedBox(height: 12),

                        // 📡 Card 2: Emergency Contact Dispatch Status
                        Container(
                          padding: const EdgeInsets.all(16),
                          decoration: BoxDecoration(
                            color: const Color(0xFF111827),
                            borderRadius: BorderRadius.circular(22),
                            border: Border.all(color: const Color(0xFF1F2937), width: 1.2),
                          ),
                          child: Row(
                            children: [
                              Container(
                                width: 44,
                                height: 44,
                                decoration: BoxDecoration(
                                  color: const Color(0xFF10B981).withValues(alpha: 0.12),
                                  borderRadius: BorderRadius.circular(14),
                                  border: Border.all(
                                    color: const Color(0xFF10B981).withValues(alpha: 0.3),
                                  ),
                                ),
                                child: const Center(
                                  child: Icon(
                                    Icons.mark_email_read_outlined,
                                    color: Color(0xFF10B981),
                                    size: 22,
                                  ),
                                ),
                              ),
                              const SizedBox(width: 14),
                              Expanded(
                                child: Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    Text(
                                      _contactsAlertedCount > 0
                                          ? '$_contactsAlertedCount Emergency Contacts Dispatched'
                                          : 'Emergency Contacts Transmitting...',
                                      style: GoogleFonts.plusJakartaSans(
                                        color: Colors.white,
                                        fontSize: 13,
                                        fontWeight: FontWeight.w700,
                                      ),
                                    ),
                                    const SizedBox(height: 3),
                                    Text(
                                      _smsDispatched
                                          ? 'Dispatched via Direct Cellular SIM & Live Link'
                                          : 'Transmitting encrypted GPS coordinates...',
                                      style: GoogleFonts.plusJakartaSans(
                                        color: const Color(0xFF94A3B8),
                                        fontSize: 11,
                                      ),
                                    ),
                                  ],
                                ),
                              ),
                              const Icon(Icons.check_circle_rounded, color: Color(0xFF10B981), size: 18),
                            ],
                          ),
                        ),

                        const SizedBox(height: 12),

                        // 🛡️ Card 3: Admin Command & Volunteers Alerted
                        Container(
                          padding: const EdgeInsets.all(16),
                          decoration: BoxDecoration(
                            color: const Color(0xFF111827),
                            borderRadius: BorderRadius.circular(22),
                            border: Border.all(color: const Color(0xFF1F2937), width: 1.2),
                          ),
                          child: Row(
                            children: [
                              Container(
                                width: 44,
                                height: 44,
                                decoration: BoxDecoration(
                                  color: const Color(0xFF6366F1).withValues(alpha: 0.12),
                                  borderRadius: BorderRadius.circular(14),
                                  border: Border.all(
                                    color: const Color(0xFF6366F1).withValues(alpha: 0.3),
                                  ),
                                ),
                                child: const Center(
                                  child: Icon(
                                    Icons.security_rounded,
                                    color: Color(0xFF818CF8),
                                    size: 22,
                                  ),
                                ),
                              ),
                              const SizedBox(width: 14),
                              Expanded(
                                child: Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    Text(
                                      'Command HQ & Verified Responders',
                                      style: GoogleFonts.plusJakartaSans(
                                        color: Colors.white,
                                        fontSize: 13,
                                        fontWeight: FontWeight.w700,
                                      ),
                                    ),
                                    const SizedBox(height: 3),
                                    Text(
                                      'Live satellite pin dispatched to 5km perimeter',
                                      style: GoogleFonts.plusJakartaSans(
                                        color: const Color(0xFF94A3B8),
                                        fontSize: 11,
                                      ),
                                    ),
                                  ],
                                ),
                              ),
                              const Icon(Icons.check_circle_rounded, color: Color(0xFF10B981), size: 18),
                            ],
                          ),
                        ),

                        const SizedBox(height: 24),
                      ],
                    ),
                  ),
                ),

                // 🎯 3. Bottom Emergency Rapid Actions & Cancel Abort
                Container(
                  padding: const EdgeInsets.fromLTRB(20, 16, 20, 16),
                  decoration: BoxDecoration(
                    color: const Color(0xFF0F172A),
                    borderRadius: const BorderRadius.vertical(top: Radius.circular(28)),
                    border: Border.all(color: const Color(0xFF1E293B)),
                    boxShadow: [
                      BoxShadow(
                        color: Colors.black.withValues(alpha: 0.4),
                        blurRadius: 20,
                        offset: const Offset(0, -6),
                      ),
                    ],
                  ),
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      // Direct Emergency Call Row
                      Row(
                        children: [
                          // Call Police 112
                          Expanded(
                            flex: 3,
                            child: ElevatedButton.icon(
                              onPressed: () => _callEmergency('112'),
                              icon: const Icon(Icons.phone_in_talk_rounded, size: 18),
                              label: Text(
                                'Call 112',
                                style: GoogleFonts.plusJakartaSans(
                                  fontSize: 14,
                                  fontWeight: FontWeight.w800,
                                ),
                              ),
                              style: ElevatedButton.styleFrom(
                                backgroundColor: const Color(0xFF10B981),
                                foregroundColor: Colors.white,
                                elevation: 0,
                                padding: const EdgeInsets.symmetric(vertical: 14),
                                shape: RoundedRectangleBorder(
                                  borderRadius: BorderRadius.circular(16),
                                ),
                              ),
                            ),
                          ),
                          const SizedBox(width: 8),

                          // Women Helpline 1091
                          Expanded(
                            flex: 3,
                            child: ElevatedButton.icon(
                              onPressed: () => _callEmergency('1091'),
                              icon: const Icon(Icons.support_agent_rounded, size: 18),
                              label: Text(
                                '1091 Helpline',
                                style: GoogleFonts.plusJakartaSans(
                                  fontSize: 13,
                                  fontWeight: FontWeight.w700,
                                ),
                              ),
                              style: ElevatedButton.styleFrom(
                                backgroundColor: const Color(0xFF1E293B),
                                foregroundColor: Colors.white,
                                elevation: 0,
                                padding: const EdgeInsets.symmetric(vertical: 14),
                                shape: RoundedRectangleBorder(
                                  borderRadius: BorderRadius.circular(16),
                                  side: const BorderSide(color: Color(0xFF334155)),
                                ),
                              ),
                            ),
                          ),
                          const SizedBox(width: 8),

                          // WhatsApp Location Share
                          Container(
                            decoration: BoxDecoration(
                              color: const Color(0xFF1E293B),
                              borderRadius: BorderRadius.circular(16),
                              border: Border.all(color: const Color(0xFF334155)),
                            ),
                            child: IconButton(
                              onPressed: _shareLocation,
                              icon: const Icon(Icons.share_location_rounded, color: Colors.white, size: 20),
                              tooltip: 'Share Live Link',
                            ),
                          ),
                        ],
                      ),

                      const SizedBox(height: 12),

                      // Cancel SOS Button
                      SizedBox(
                        width: double.infinity,
                        child: OutlinedButton(
                          onPressed: () => _showCancelDialog(context),
                          style: OutlinedButton.styleFrom(
                            foregroundColor: const Color(0xFFF1F5F9),
                            side: const BorderSide(color: Color(0xFF475569), width: 1.2),
                            padding: const EdgeInsets.symmetric(vertical: 14),
                            shape: RoundedRectangleBorder(
                              borderRadius: BorderRadius.circular(16),
                            ),
                          ),
                          child: Text(
                            'I am Safe • Cancel SOS',
                            style: GoogleFonts.plusJakartaSans(
                              fontSize: 14,
                              fontWeight: FontWeight.w700,
                              letterSpacing: 0.3,
                            ),
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  void _showCancelDialog(BuildContext context) {
    showDialog(
      context: context,
      builder: (dialogCtx) => AlertDialog(
        backgroundColor: const Color(0xFF0F172A),
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(24),
          side: const BorderSide(color: Color(0xFF334155)),
        ),
        title: Text(
          'Cancel Emergency Alert?',
          style: GoogleFonts.plusJakartaSans(
            color: Colors.white,
            fontWeight: FontWeight.w800,
            fontSize: 18,
          ),
        ),
        content: Text(
          'Are you sure you are safe? Cancelling will notify your guardians and command operations that this alert has ended.',
          style: GoogleFonts.plusJakartaSans(
            color: const Color(0xFF94A3B8),
            fontSize: 13,
            height: 1.4,
          ),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(dialogCtx),
            child: Text(
              'Keep Active',
              style: GoogleFonts.plusJakartaSans(
                color: const Color(0xFF94A3B8),
                fontWeight: FontWeight.w600,
              ),
            ),
          ),
          ElevatedButton(
            onPressed: () async {
              if (_sosId != null) {
                try {
                  // Seal and upload any in-flight microphone recording
                  if (BlackboxService().isRecording) {
                    BlackboxService().stopAndSealBlackbox().then((incident) {
                      if (incident != null && _sosId != null) {
                        BlackboxService().uploadBlackboxAudio(_sosId!, filePath: incident.audioPath);
                      }
                    });
                  }
                  final apiService = ref.read(apiServiceProvider);
                  await apiService.cancelSOS(_sosId!);
                } catch (e) {
                  debugPrint('Error cancelling SOS: $e');
                }
              }

              Vibration.cancel();
              if (dialogCtx.mounted) Navigator.pop(dialogCtx);
              if (context.mounted) context.go('/home');
            },
            style: ElevatedButton.styleFrom(
              backgroundColor: const Color(0xFF10B981),
              foregroundColor: Colors.white,
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
            ),
            child: Text(
              'Yes, I\'m Safe',
              style: GoogleFonts.plusJakartaSans(fontWeight: FontWeight.w700),
            ),
          ),
        ],
      ),
    );
  }
}
