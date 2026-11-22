import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:go_router/go_router.dart';
import 'package:geolocator/geolocator.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../core/services/api_service.dart';
import '../../../shared/theme/app_theme.dart';
import '../../../shared/providers/user_provider.dart';
import '../../volunteer/screens/volunteer_screen.dart';
import '../../../core/utils/shake_detector.dart';
import '../../../core/services/voice_trigger_service.dart';
import '../../../core/services/stalker_radar_service.dart';
import '../../../core/services/blackbox_service.dart';

class HomeScreen extends ConsumerStatefulWidget {
  const HomeScreen({super.key});

  @override
  ConsumerState<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends ConsumerState<HomeScreen> with SingleTickerProviderStateMixin {
  int _selectedIndex = 0;
  int _modeIndex = 0; // 0 = Emergency SOS, 1 = Safe Routes (matching reference Screen 2)
  Timer? _locationTimer;
  ShakeDetector? _shakeDetector;
  int _safeZones = 12;
  int _dangerZones = 5;
  int _volunteers = 24;
  late AnimationController _pulseController;
  late Animation<double> _pulseAnimation;
  final TextEditingController _destinationSearchController = TextEditingController();
  int _selectedFilterPill = 0;

  @override
  void initState() {
    super.initState();
    _pulseController = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 1800),
    )..repeat(reverse: true);
    _pulseAnimation = Tween<double>(begin: 0.96, end: 1.05).animate(
      CurvedAnimation(parent: _pulseController, curve: Curves.easeInOutSine),
    );
    _initData();
  }

  void _initData() {
    ref.read(userProvider.notifier).fetchProfile();
    _checkPermissionsAndStartTracking();
    _fetchStats();
    _initShakeDetector();
    _initVoiceTrigger();
    // SMS permissions are requested in main.dart via SMSService.init()
  }

  void _initVoiceTrigger() {
    VoiceTriggerService().startListening(
      onTrigger: (keyword) {
        if (!mounted) return;
        HapticFeedback.heavyImpact();
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('🚨 Distress voice command detected ("$keyword")! Launching SOS...'),
            backgroundColor: const Color(0xFFFF2D78),
            duration: const Duration(seconds: 3),
          ),
        );
        context.push('/sos');
      },
    );
  }

  void _initShakeDetector() {
    _shakeDetector = ShakeDetector(
      onPhoneShake: () {
        if (!mounted) return;
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: const Text('🚨 Emergency Shake Detected! Launching SOS...'),
            backgroundColor: AppColors.primary,
            duration: const Duration(seconds: 2),
          ),
        );
        context.push('/sos');
      },
      shakeThresholdGravity: 2.5,
      minimumShakeCount: 2,
    );
    _shakeDetector!.startListening();
    debugPrint('ShakeDetector started listening');
  }

  Future<void> _fetchStats() async {
    try {
      final api = ref.read(apiServiceProvider);
      final res = await api.getDashboardStats();
      if (res.data != null && mounted) {
        setState(() {
          _safeZones = res.data['safeZones'] ?? _safeZones;
          _dangerZones = res.data['dangerZones'] ?? _dangerZones;
          _volunteers = res.data['volunteers'] ?? _volunteers;
        });
      }
    } catch (e) {
      debugPrint('Error fetching dashboard stats: $e');
    }
  }

  @override
  void dispose() {
    _pulseController.dispose();
    _destinationSearchController.dispose();
    _shakeDetector?.stopListening();
    _locationTimer?.cancel();
    super.dispose();
  }

  Future<void> _checkPermissionsAndStartTracking() async {
    bool serviceEnabled;
    LocationPermission permission;

    serviceEnabled = await Geolocator.isLocationServiceEnabled();
    if (!serviceEnabled) return;

    permission = await Geolocator.checkPermission();
    if (permission == LocationPermission.denied) {
      permission = await Geolocator.requestPermission();
      if (permission == LocationPermission.denied) return;
    }

    if (permission == LocationPermission.deniedForever) return;

    // Initial update
    _updateLocation();

    // Periodic updates every 60 seconds
    _locationTimer = Timer.periodic(const Duration(seconds: 60), (_) {
      _updateLocation();
    });
  }

  Future<void> _updateLocation() async {
    try {
      final position = await Geolocator.getCurrentPosition();
      final apiService = ref.read(apiServiceProvider);
      await apiService.updateUserLocation(position.latitude, position.longitude);
      debugPrint('User location updated: ${position.latitude}, ${position.longitude}');
    } catch (e) {
      debugPrint('Failed to update user location: $e');
    }
  }

  @override
  Widget build(BuildContext context) {
    final userState = ref.watch(userProvider);

    // Debug log to trace role issues
    debugPrint('HomeScreen - User role: ${userState.role}, isLoading: ${userState.isLoading}');

    // Show Volunteer Dashboard if user is a verified volunteer
    if (userState.role == 'volunteer') {
      debugPrint('Showing VolunteerScreen for role: ${userState.role}');
      return const VolunteerScreen();
    }

    debugPrint('Showing regular Home for role: ${userState.role}');

    final userName = userState.name ?? 'there';

    return Scaffold(
      backgroundColor: AppColors.background,
      body: SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.symmetric(horizontal: 20),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const SizedBox(height: 16),

              // Header with greeting and notification bell
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        'Hi, $userName 👋',
                        style: const TextStyle(
                          fontSize: 24,
                          fontWeight: FontWeight.bold,
                          color: AppColors.textPrimary,
                        ),
                      ),
                      const SizedBox(height: 4),
                      const Text(
                        'Stay safe, we\'re here for you',
                        style: TextStyle(
                          fontSize: 14,
                          color: AppColors.textSecondary,
                        ),
                      ),
                    ],
                  ),
                  GestureDetector(
                    onTap: () => context.push('/notifications'),
                    child: Container(
                      width: 46,
                      height: 46,
                      decoration: BoxDecoration(
                        color: Colors.white,
                        borderRadius: BorderRadius.circular(16),
                        border: Border.all(color: Colors.white, width: 1.5),
                        boxShadow: [
                          BoxShadow(
                            color: Colors.black.withValues(alpha: 0.04),
                            blurRadius: 16,
                            offset: const Offset(0, 4),
                          ),
                        ],
                      ),
                      child: Stack(
                        alignment: Alignment.center,
                        children: [
                          const Icon(
                            Icons.notifications_outlined,
                            color: AppColors.textPrimary,
                            size: 22,
                          ),
                          Positioned(
                            top: 11,
                            right: 12,
                            child: Container(
                              width: 8,
                              height: 8,
                              decoration: const BoxDecoration(
                                color: Color(0xFFFF2D78),
                                shape: BoxShape.circle,
                              ),
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),
                ],
              ),

              const SizedBox(height: 20),

              // 💎 Segmented Glass Pill Switcher (matching reference Image Screen 2)
              Center(
                child: Container(
                  padding: const EdgeInsets.all(4),
                  decoration: BoxDecoration(
                    color: const Color(0xFFF1F2F5),
                    borderRadius: BorderRadius.circular(32),
                  ),
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      GestureDetector(
                        onTap: () {
                          HapticFeedback.selectionClick();
                          setState(() => _modeIndex = 0);
                        },
                        child: AnimatedContainer(
                          duration: const Duration(milliseconds: 220),
                          padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 9),
                          decoration: BoxDecoration(
                            color: _modeIndex == 0 ? const Color(0xFF1E2124) : Colors.transparent,
                            borderRadius: BorderRadius.circular(24),
                            boxShadow: _modeIndex == 0
                                ? [
                                    BoxShadow(
                                      color: Colors.black.withValues(alpha: 0.15),
                                      blurRadius: 10,
                                      offset: const Offset(0, 3),
                                    )
                                  ]
                                : null,
                          ),
                          child: Row(
                            children: [
                              if (_modeIndex == 0)
                                Container(
                                  width: 6,
                                  height: 6,
                                  margin: const EdgeInsets.only(right: 6),
                                  decoration: const BoxDecoration(
                                    color: Color(0xFFFF2D78),
                                    shape: BoxShape.circle,
                                  ),
                                ),
                              Text(
                                'Emergency SOS',
                                style: TextStyle(
                                  fontSize: 12,
                                  fontWeight: FontWeight.w700,
                                  color: _modeIndex == 0 ? Colors.white : const Color(0xFF71717A),
                                  letterSpacing: -0.2,
                                ),
                              ),
                            ],
                          ),
                        ),
                      ),
                      GestureDetector(
                        onTap: () {
                          HapticFeedback.selectionClick();
                          setState(() => _modeIndex = 1);
                        },
                        child: AnimatedContainer(
                          duration: const Duration(milliseconds: 220),
                          padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 9),
                          decoration: BoxDecoration(
                            color: _modeIndex == 1 ? const Color(0xFF1E2124) : Colors.transparent,
                            borderRadius: BorderRadius.circular(24),
                            boxShadow: _modeIndex == 1
                                ? [
                                    BoxShadow(
                                      color: Colors.black.withValues(alpha: 0.15),
                                      blurRadius: 10,
                                      offset: const Offset(0, 3),
                                    )
                                  ]
                                : null,
                          ),
                          child: Row(
                            children: [
                              if (_modeIndex == 1)
                                Container(
                                  width: 6,
                                  height: 6,
                                  margin: const EdgeInsets.only(right: 6),
                                  decoration: const BoxDecoration(
                                    color: Color(0xFFFF2D78),
                                    shape: BoxShape.circle,
                                  ),
                                ),
                              Text(
                                'Safe Routes',
                                style: TextStyle(
                                  fontSize: 12,
                                  fontWeight: FontWeight.w700,
                                  color: _modeIndex == 1 ? Colors.white : const Color(0xFF71717A),
                                  letterSpacing: -0.2,
                                ),
                              ),
                            ],
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
              ),

              const SizedBox(height: 24),

              if (_modeIndex == 1) ...[
                // 💎 "Where Your Destination?" Card directly matching Reference Screen 2
                Container(
                  padding: const EdgeInsets.all(22),
                  decoration: BoxDecoration(
                    color: Colors.white,
                    borderRadius: BorderRadius.circular(28),
                    border: Border.all(color: Colors.white, width: 1.5),
                    boxShadow: [
                      BoxShadow(
                        color: Colors.black.withValues(alpha: 0.05),
                        blurRadius: 20,
                        offset: const Offset(0, 6),
                      ),
                    ],
                  ),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        children: [
                          const Text(
                            'Where Your Destination?',
                            style: TextStyle(
                              fontSize: 18,
                              fontWeight: FontWeight.w800,
                              color: AppColors.textPrimary,
                              letterSpacing: -0.3,
                            ),
                          ),
                          Container(
                            padding: const EdgeInsets.all(6),
                            decoration: BoxDecoration(
                              color: const Color(0xFFF4F5F7),
                              shape: BoxShape.circle,
                            ),
                            child: const Icon(Icons.sync_rounded, size: 16, color: Color(0xFF71717A)),
                          ),
                        ],
                      ),
                      const SizedBox(height: 14),
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 16),
                        decoration: BoxDecoration(
                          color: const Color(0xFFF7F8FA),
                          borderRadius: BorderRadius.circular(18),
                          border: Border.all(color: const Color(0xFFEFEFEF)),
                        ),
                        child: TextField(
                          controller: _destinationSearchController,
                          decoration: const InputDecoration(
                            hintText: 'Search safe destinations...',
                            hintStyle: TextStyle(fontSize: 14, color: Color(0xFFA1A1AA)),
                            border: InputBorder.none,
                            enabledBorder: InputBorder.none,
                            focusedBorder: InputBorder.none,
                            suffixIcon: Icon(Icons.search_rounded, color: Color(0xFF71717A), size: 20),
                          ),
                        ),
                      ),
                      const SizedBox(height: 16),
                      SingleChildScrollView(
                        scrollDirection: Axis.horizontal,
                        child: Row(
                          children: [
                            _buildFilterPill(0, 'I\'m Flexible'),
                            const SizedBox(width: 8),
                            _buildFilterPill(1, 'Police Stations'),
                            const SizedBox(width: 8),
                            _buildFilterPill(2, 'Safe Havens'),
                          ],
                        ),
                      ),
                      const SizedBox(height: 20),
                      Row(
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        children: [
                          TextButton(
                            onPressed: () {
                              _destinationSearchController.clear();
                              setState(() => _selectedFilterPill = 0);
                            },
                            child: const Text('Clear', style: TextStyle(color: Color(0xFF71717A), fontWeight: FontWeight.w600)),
                          ),
                          ElevatedButton(
                            onPressed: () => context.push('/map'),
                            style: ElevatedButton.styleFrom(
                              backgroundColor: const Color(0xFFFFD1E1),
                              foregroundColor: const Color(0xFFFF2D78),
                              elevation: 0,
                              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
                              padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 12),
                            ),
                            child: const Text('Next', style: TextStyle(fontWeight: FontWeight.w800)),
                          ),
                        ],
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: 14),
                // "When & Who" Safety Guard Cards
                Container(
                  padding: const EdgeInsets.all(20),
                  decoration: BoxDecoration(
                    color: Colors.white,
                    borderRadius: BorderRadius.circular(24),
                    border: Border.all(color: Colors.white, width: 1.5),
                    boxShadow: [
                      BoxShadow(color: Colors.black.withValues(alpha: 0.04), blurRadius: 16, offset: const Offset(0, 4)),
                    ],
                  ),
                  child: Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: const [
                          Text('Guard Protocol', style: TextStyle(fontSize: 16, fontWeight: FontWeight.w800, color: AppColors.textPrimary)),
                          SizedBox(height: 4),
                          Text('• 24/7 Live Satellite Monitoring', style: TextStyle(fontSize: 12, color: Color(0xFF71717A))),
                        ],
                      ),
                      Container(
                        padding: const EdgeInsets.all(6),
                        decoration: const BoxDecoration(color: Color(0xFFF4F5F7), shape: BoxShape.circle),
                        child: const Icon(Icons.sync_rounded, size: 16, color: Color(0xFF71717A)),
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: 24),
                // Prominent Hot Pink Search Button (matching reference)
                GestureDetector(
                  onTap: () {
                    HapticFeedback.heavyImpact();
                    context.push('/journey');
                  },
                  child: Container(
                    width: double.infinity,
                    padding: const EdgeInsets.symmetric(vertical: 18),
                    decoration: BoxDecoration(
                      gradient: const LinearGradient(
                        colors: [Color(0xFFFF2D78), Color(0xFFFF5293)],
                      ),
                      borderRadius: BorderRadius.circular(24),
                      boxShadow: [
                        BoxShadow(
                          color: const Color(0xFFFF2D78).withValues(alpha: 0.38),
                          blurRadius: 20,
                          offset: const Offset(0, 6),
                        ),
                      ],
                    ),
                    child: const Center(
                      child: Text(
                        'Start Protected Journey',
                        style: TextStyle(
                          color: Colors.white,
                          fontSize: 16,
                          fontWeight: FontWeight.w800,
                          letterSpacing: 0.2,
                        ),
                      ),
                    ),
                  ),
                ),
                const SizedBox(height: 24),
              ] else ...[
                // 💎 Stats Card — white rounded-20 with soft shadow
                Container(
                  padding: const EdgeInsets.symmetric(vertical: 20, horizontal: 16),
                  decoration: BoxDecoration(
                    color: Colors.white,
                    borderRadius: BorderRadius.circular(24),
                    border: Border.all(color: Colors.white, width: 1.5),
                    boxShadow: [
                      BoxShadow(
                        color: Colors.black.withValues(alpha: 0.05),
                        blurRadius: 18,
                        offset: const Offset(0, 4),
                      ),
                    ],
                  ),
                  child: Row(
                    mainAxisAlignment: MainAxisAlignment.spaceAround,
                    children: [
                      _buildStatItem(
                        icon: Icons.shield_rounded,
                        label: 'Safe Zones',
                        value: '$_safeZones',
                        color: AppColors.safe,
                      ),
                      Container(width: 1, height: 40, color: const Color(0xFFF1F2F4)),
                      _buildStatItem(
                        icon: Icons.warning_rounded,
                        label: 'Danger Zones',
                        value: '$_dangerZones',
                        color: AppColors.danger,
                      ),
                      Container(width: 1, height: 40, color: const Color(0xFFF1F2F4)),
                      _buildStatItem(
                        icon: Icons.people_rounded,
                        label: 'Volunteers',
                        value: '$_volunteers',
                        color: AppColors.primary,
                      ),
                    ],
                  ),
                ),

                const SizedBox(height: 32),

                // 💎 Dynamic Breathing Glass SOS Button with Haptic Feedback
                Center(
                  child: Column(
                    children: [
                      GestureDetector(
                        onTap: () {
                          HapticFeedback.heavyImpact();
                          context.push('/sos');
                        },
                        child: AnimatedBuilder(
                          animation: _pulseAnimation,
                          builder: (context, child) {
                            return Transform.scale(
                              scale: _pulseAnimation.value,
                              child: Stack(
                                alignment: Alignment.center,
                                children: [
                                  // Outer frosted glass ring
                                  Container(
                                    width: 205,
                                    height: 205,
                                    decoration: BoxDecoration(
                                      shape: BoxShape.circle,
                                      color: const Color(0xFFFF2D78).withValues(alpha: 0.07),
                                      border: Border.all(
                                        color: const Color(0xFFFF2D78).withValues(alpha: 0.22),
                                        width: 1.5,
                                      ),
                                    ),
                                  ),
                                  // Middle ambient glass ring
                                  Container(
                                    width: 175,
                                    height: 175,
                                    decoration: BoxDecoration(
                                      shape: BoxShape.circle,
                                      color: const Color(0xFFFF2D78).withValues(alpha: 0.14),
                                      border: Border.all(
                                        color: const Color(0xFFFF2D78).withValues(alpha: 0.32),
                                        width: 1.5,
                                      ),
                                    ),
                                  ),
                                  // Core vibrant glossy glass orb
                                  Container(
                                    width: 148,
                                    height: 148,
                                    decoration: BoxDecoration(
                                      shape: BoxShape.circle,
                                      gradient: const LinearGradient(
                                        begin: Alignment.topLeft,
                                        end: Alignment.bottomRight,
                                        colors: [
                                          Color(0xFFFF337F),
                                          Color(0xFFFF1493),
                                          Color(0xFFC2185B),
                                        ],
                                      ),
                                      boxShadow: [
                                        BoxShadow(
                                          color: const Color(0xFFFF1493).withValues(alpha: 0.45),
                                          blurRadius: 30,
                                          spreadRadius: 6,
                                          offset: const Offset(0, 10),
                                        ),
                                        BoxShadow(
                                          color: Colors.white.withValues(alpha: 0.7),
                                          blurRadius: 12,
                                          offset: const Offset(-2, -3),
                                        ),
                                      ],
                                    ),
                                    child: const Center(
                                      child: Text(
                                        'SOS',
                                        style: TextStyle(
                                          color: Colors.white,
                                          fontSize: 36,
                                          fontWeight: FontWeight.w900,
                                          letterSpacing: 4,
                                        ),
                                      ),
                                    ),
                                  ),
                                ],
                              ),
                            );
                          },
                        ),
                      ),
                      const SizedBox(height: 18),
                      const Text(
                        'Tap for Emergency',
                        style: TextStyle(
                          fontSize: 17,
                          fontWeight: FontWeight.w700,
                          color: AppColors.textPrimary,
                          letterSpacing: -0.3,
                        ),
                      ),
                      const SizedBox(height: 4),
                      const Text(
                        'Or shake phone twice to trigger',
                        style: TextStyle(
                          fontSize: 13,
                          fontWeight: FontWeight.w500,
                          color: AppColors.textSecondary,
                        ),
                      ),
                      const SizedBox(height: 14),

                      // 🛡️ Guardian Voice Sentinel Pill (Screen Off / Background Detection)
                      ValueListenableBuilder<bool>(
                        valueListenable: VoiceTriggerService().isListeningNotifier,
                        builder: (context, isListening, _) {
                          final isEnabled = VoiceTriggerService().isEnabled;
                          return GestureDetector(
                            onTap: () async {
                              HapticFeedback.lightImpact();
                              if (isEnabled) {
                                await VoiceTriggerService().stopListening();
                              } else {
                                final started = await VoiceTriggerService().startListening();
                                if (!started && context.mounted) {
                                  ScaffoldMessenger.of(context).showSnackBar(
                                    const SnackBar(
                                      content: Text('Microphone permission is required to enable Voice Sentinel.'),
                                      backgroundColor: Color(0xFFEF4444),
                                      duration: Duration(seconds: 4),
                                    ),
                                  );
                                }
                              }
                              if (mounted) setState(() {});
                            },
                            child: Container(
                              padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
                              decoration: BoxDecoration(
                                color: isEnabled
                                    ? const Color(0xFF10B981).withValues(alpha: 0.1)
                                    : const Color(0xFF71717A).withValues(alpha: 0.08),
                                borderRadius: BorderRadius.circular(24),
                                border: Border.all(
                                  color: isEnabled
                                      ? const Color(0xFF10B981).withValues(alpha: 0.35)
                                      : const Color(0xFFE4E4E7),
                                  width: 1,
                                ),
                              ),
                              child: Row(
                                mainAxisSize: MainAxisSize.min,
                                children: [
                                  Container(
                                    width: 7,
                                    height: 7,
                                    margin: const EdgeInsets.only(right: 7),
                                    decoration: BoxDecoration(
                                      color: isEnabled ? const Color(0xFF10B981) : const Color(0xFF9CA3AF),
                                      shape: BoxShape.circle,
                                    ),
                                  ),
                                  Icon(
                                    isEnabled ? Icons.mic_rounded : Icons.mic_off_rounded,
                                    size: 14,
                                    color: isEnabled ? const Color(0xFF047857) : const Color(0xFF71717A),
                                  ),
                                  const SizedBox(width: 6),
                                  Text(
                                    isEnabled
                                        ? 'Voice Sentinel: Active (Say "Help" / "Bachao")'
                                        : 'Voice Sentinel: Off (Tap to enable)',
                                    style: TextStyle(
                                      fontSize: 11,
                                      fontWeight: FontWeight.w700,
                                      color: isEnabled ? const Color(0xFF047857) : const Color(0xFF71717A),
                                      letterSpacing: -0.2,
                                    ),
                                  ),
                                ],
                              ),
                            ),
                          );
                        },
                      ),
                    ],
                  ),
                ),

                const SizedBox(height: 32),
              ],

              // 📡 Bluetooth Stalker Radar ("Am I Being Followed?") Shield Card
              ValueListenableBuilder<bool>(
                valueListenable: StalkerRadarService().isMonitoringNotifier,
                builder: (context, isRadarOn, _) {
                  return ValueListenableBuilder<List<SuspectFollower>>(
                    valueListenable: StalkerRadarService().activeAlertsNotifier,
                    builder: (context, alerts, _) {
                      final hasAlert = alerts.isNotEmpty;
                      return Container(
                        margin: const EdgeInsets.only(bottom: 20),
                        padding: const EdgeInsets.all(16),
                        decoration: BoxDecoration(
                          color: hasAlert ? const Color(0xFFFEF2F2) : Colors.white,
                          borderRadius: BorderRadius.circular(24),
                          border: Border.all(
                            color: hasAlert
                                ? const Color(0xFFEF4444).withValues(alpha: 0.5)
                                : Colors.white,
                            width: 1.5,
                          ),
                          boxShadow: [
                            BoxShadow(
                              color: hasAlert
                                  ? const Color(0xFFEF4444).withValues(alpha: 0.12)
                                  : Colors.black.withValues(alpha: 0.04),
                              blurRadius: 16,
                              offset: const Offset(0, 4),
                            ),
                          ],
                        ),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Row(
                              children: [
                                Container(
                                  width: 40,
                                  height: 40,
                                  decoration: BoxDecoration(
                                    color: hasAlert
                                        ? const Color(0xFFFEE2E2)
                                        : const Color(0xFF6366F1).withValues(alpha: 0.1),
                                    shape: BoxShape.circle,
                                  ),
                                  child: Icon(
                                    hasAlert ? Icons.warning_rounded : Icons.radar_rounded,
                                    color: hasAlert ? const Color(0xFFEF4444) : const Color(0xFF6366F1),
                                    size: 20,
                                  ),
                                ),
                                const SizedBox(width: 12),
                                Expanded(
                                  child: Column(
                                    crossAxisAlignment: CrossAxisAlignment.start,
                                    children: [
                                      Text(
                                        hasAlert
                                            ? '⚠️ Potential Follower Detected!'
                                            : 'Bluetooth Stalker Radar',
                                        style: TextStyle(
                                          fontSize: 14,
                                          fontWeight: FontWeight.w700,
                                          color: hasAlert ? const Color(0xFFB91C1C) : const Color(0xFF1E2124),
                                        ),
                                      ),
                                      const SizedBox(height: 2),
                                      Text(
                                        hasAlert
                                            ? 'A nearby BLE device has traveled with you for ${alerts.first.distanceTraveledMeters.toStringAsFixed(0)}m'
                                            : isRadarOn
                                                ? 'Actively scanning beacons for persistent co-travelers...'
                                                : 'Detects if someone with a phone/smartwatch follows your route',
                                        style: TextStyle(
                                          fontSize: 11,
                                          fontWeight: FontWeight.w500,
                                          color: hasAlert ? const Color(0xFFDC2626) : const Color(0xFF71717A),
                                        ),
                                      ),
                                    ],
                                  ),
                                ),
                                Switch.adaptive(
                                  value: isRadarOn,
                                  activeColor: const Color(0xFFFF2D78),
                                  onChanged: (val) async {
                                    HapticFeedback.lightImpact();
                                    if (val) {
                                      final res = await StalkerRadarService().startRadar(
                                        onAlert: (alert) {
                                          if (!mounted) return;
                                          ScaffoldMessenger.of(context).showSnackBar(
                                            SnackBar(
                                              content: Text(
                                                '⚠️ Follower Warning: Nearby device following you for ${alert.distanceTraveledMeters.toStringAsFixed(0)}m!',
                                              ),
                                              backgroundColor: const Color(0xFFEF4444),
                                              duration: const Duration(seconds: 5),
                                            ),
                                          );
                                        },
                                      );
                                      if (!res.success && mounted) {
                                        ScaffoldMessenger.of(context).showSnackBar(
                                          SnackBar(
                                            content: Text(res.message ?? 'Bluetooth must be turned on to use Stalker Radar.'),
                                            backgroundColor: const Color(0xFFEF4444),
                                            duration: const Duration(seconds: 4),
                                          ),
                                        );
                                      }
                                    } else {
                                      await StalkerRadarService().stopRadar();
                                    }
                                    if (mounted) setState(() {});
                                  },
                                ),
                              ],
                            ),
                            if (hasAlert) ...[
                              const SizedBox(height: 12),
                              Row(
                                children: [
                                  Expanded(
                                    child: ElevatedButton.icon(
                                      onPressed: () => context.push('/map'),
                                      icon: const Icon(Icons.shield_rounded, size: 16),
                                      label: const Text('Nearest Haven', style: TextStyle(fontSize: 12, fontWeight: FontWeight.bold)),
                                      style: ElevatedButton.styleFrom(
                                        backgroundColor: const Color(0xFF10B981),
                                        foregroundColor: Colors.white,
                                        elevation: 0,
                                        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
                                        padding: const EdgeInsets.symmetric(vertical: 10),
                                      ),
                                    ),
                                  ),
                                  const SizedBox(width: 8),
                                  Expanded(
                                    child: ElevatedButton.icon(
                                      onPressed: () => context.push('/sos'),
                                      icon: const Icon(Icons.emergency_rounded, size: 16),
                                      label: const Text('Arm SOS', style: TextStyle(fontSize: 12, fontWeight: FontWeight.bold)),
                                      style: ElevatedButton.styleFrom(
                                        backgroundColor: const Color(0xFFFF2D78),
                                        foregroundColor: Colors.white,
                                        elevation: 0,
                                        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
                                        padding: const EdgeInsets.symmetric(vertical: 10),
                                      ),
                                    ),
                                  ),
                                ],
                              ),
                            ],
                          ],
                        ),
                      );
                    },
                  );
                },
              ),

              // Quick Actions label
              const Text(
                'Quick Actions',
                style: TextStyle(
                  fontSize: 18,
                  fontWeight: FontWeight.w600,
                  color: AppColors.textPrimary,
                ),
              ),
              const SizedBox(height: 14),

              // Quick Actions — 2 rows of 3 rounded-16 white cards
              Row(
                children: [
                  Expanded(
                    child: _buildQuickAction(
                      context,
                      icon: Icons.timer_rounded,
                      label: 'Safety Timer',
                      onTap: () => context.push('/safety-timer'),
                    ),
                  ),
                  const SizedBox(width: 10),
                  Expanded(
                    child: _buildQuickAction(
                      context,
                      icon: Icons.directions_car_rounded,
                      label: 'Journey Guard',
                      onTap: () => context.push('/journey'),
                    ),
                  ),
                  const SizedBox(width: 10),
                  Expanded(
                    child: _buildQuickAction(
                      context,
                      icon: Icons.phone_in_talk_rounded,
                      label: 'Fake Call',
                      onTap: () => context.push('/fake-call'),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 10),
              Row(
                children: [
                  Expanded(
                    child: _buildQuickAction(
                      context,
                      icon: Icons.calculate_rounded,
                      label: 'Stealth SOS',
                      onTap: () => context.push('/stealth-calc'),
                    ),
                  ),
                  const SizedBox(width: 10),
                  Expanded(
                    child: _buildQuickAction(
                      context,
                      icon: Icons.warning_amber_rounded,
                      label: 'Report Spot',
                      onTap: () => context.push('/report-incident'),
                    ),
                  ),
                  const SizedBox(width: 10),
                  Expanded(
                    child: _buildQuickAction(
                      context,
                      icon: Icons.verified_user_rounded,
                      label: 'Evidence',
                      onTap: () => context.push('/history'),
                    ),
                  ),
                ],
              ),

              const SizedBox(height: 24),
            ],
          ),
        ),
      ),

      // 💎 Ultra-Premium Floating Glass Pill Navigation Bar (matches reference)
      bottomNavigationBar: Container(
        margin: const EdgeInsets.fromLTRB(20, 0, 20, 20),
        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 8),
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(36),
          border: Border.all(color: Colors.white.withValues(alpha: 0.9), width: 1.5),
          boxShadow: [
            BoxShadow(
              color: const Color(0xFFFF1493).withValues(alpha: 0.08),
              blurRadius: 24,
              offset: const Offset(0, 8),
            ),
            BoxShadow(
              color: Colors.black.withValues(alpha: 0.05),
              blurRadius: 16,
              offset: const Offset(0, 4),
            ),
          ],
        ),
        child: Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            _buildNavItem(Icons.home_rounded, 'Home', 0),
            _buildNavItem(Icons.map_rounded, 'Radar', 1),
            _buildNavItem(Icons.contacts_rounded, 'Guardians', 2),
            _buildNavItem(Icons.person_rounded, 'Profile', 3),
          ],
        ),
      ),
    );
  }

  Widget _buildNavItem(IconData icon, String label, int index) {
    final isSelected = _selectedIndex == index;
    return GestureDetector(
      onTap: () {
        setState(() => _selectedIndex = index);
        switch (index) {
          case 0:
            break;
          case 1:
            context.push('/map');
            break;
          case 2:
            context.push('/contacts');
            break;
          case 3:
            context.push('/profile');
            break;
        }
      },
      behavior: HitTestBehavior.opaque,
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 250),
        curve: Curves.easeOutCubic,
        padding: EdgeInsets.symmetric(
          horizontal: isSelected ? 18 : 12,
          vertical: 10,
        ),
        decoration: BoxDecoration(
          color: isSelected ? const Color(0xFFFF2D78) : Colors.transparent,
          borderRadius: BorderRadius.circular(28),
          boxShadow: isSelected
              ? [
                  BoxShadow(
                    color: const Color(0xFFFF2D78).withValues(alpha: 0.38),
                    blurRadius: 14,
                    offset: const Offset(0, 4),
                  ),
                ]
              : null,
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(
              icon,
              color: isSelected ? Colors.white : const Color(0xFF71717A),
              size: 20,
            ),
            if (isSelected) ...[
              const SizedBox(width: 7),
              Text(
                label,
                style: const TextStyle(
                  color: Colors.white,
                  fontWeight: FontWeight.w700,
                  fontSize: 13,
                  letterSpacing: -0.2,
                ),
              ),
            ],
          ],
        ),
      ),
    );
  }

  Widget _buildStatItem({
    required IconData icon,
    required String label,
    required String value,
    required Color color,
  }) {
    return Column(
      children: [
        Container(
          width: 44,
          height: 44,
          decoration: BoxDecoration(
            color: color.withValues(alpha: 0.1),
            borderRadius: BorderRadius.circular(14),
          ),
          child: Icon(icon, color: color, size: 22),
        ),
        const SizedBox(height: 8),
        Text(
          value,
          style: TextStyle(
            fontSize: 20,
            fontWeight: FontWeight.bold,
            color: AppColors.textPrimary,
          ),
        ),
        const SizedBox(height: 2),
        Text(
          label,
          style: const TextStyle(
            fontSize: 11,
            color: AppColors.textSecondary,
          ),
        ),
      ],
    );
  }

  Widget _buildQuickAction(
    BuildContext context, {
    required IconData icon,
    required String label,
    required VoidCallback onTap,
  }) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.symmetric(vertical: 16, horizontal: 8),
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(16),
          boxShadow: [
            BoxShadow(
              color: Colors.black.withValues(alpha: 0.06),
              blurRadius: 12,
              offset: const Offset(0, 4),
            ),
          ],
        ),
        child: Column(
          children: [
            Container(
              width: 42,
              height: 42,
              decoration: BoxDecoration(
                color: AppColors.primaryLight,
                borderRadius: BorderRadius.circular(12),
              ),
              child: Icon(icon, color: AppColors.primary, size: 22),
            ),
            const SizedBox(height: 8),
            Text(
              label,
              style: const TextStyle(
                fontSize: 11,
                fontWeight: FontWeight.w500,
                color: AppColors.textPrimary,
              ),
              textAlign: TextAlign.center,
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildFilterPill(int index, String label) {
    final isSelected = _selectedFilterPill == index;
    return GestureDetector(
      onTap: () {
        HapticFeedback.selectionClick();
        setState(() => _selectedFilterPill = index);
      },
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
        decoration: BoxDecoration(
          color: isSelected ? const Color(0xFFFFF0F5) : const Color(0xFFF7F8FA),
          borderRadius: BorderRadius.circular(20),
          border: Border.all(
            color: isSelected ? const Color(0xFFFF2D78) : const Color(0xFFEFEFEF),
            width: isSelected ? 1.5 : 1.0,
          ),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            if (isSelected)
              Container(
                width: 6,
                height: 6,
                margin: const EdgeInsets.only(right: 6),
                decoration: const BoxDecoration(
                  color: Color(0xFFFF2D78),
                  shape: BoxShape.circle,
                ),
              ),
            Text(
              label,
              style: TextStyle(
                fontSize: 12,
                fontWeight: isSelected ? FontWeight.w700 : FontWeight.w500,
                color: isSelected ? const Color(0xFFFF2D78) : const Color(0xFF71717A),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
