import 'dart:async';
import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:geolocator/geolocator.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../core/services/api_service.dart';
import '../../../shared/theme/app_theme.dart';
import '../../../shared/providers/user_provider.dart';
import '../../volunteer/screens/volunteer_screen.dart';

class HomeScreen extends ConsumerStatefulWidget {
  const HomeScreen({super.key});

  @override
  ConsumerState<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends ConsumerState<HomeScreen> {
  int _selectedIndex = 0;
  Timer? _locationTimer;

  @override
  void initState() {
    super.initState();
    _initData();
  }

  void _initData() {
    ref.read(userProvider.notifier).fetchProfile();
    _checkPermissionsAndStartTracking();
    // SMS permissions are requested in main.dart via SMSService.init()
  }

  @override
  void dispose() {
    _locationTimer?.cancel();
    super.dispose();
  }

  Future<void> _checkPermissionsAndStartTracking() async {
    // ... same as before
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

    // Otherwise show Standard User SOS Screen (even while loading profile in background)
    return Scaffold(
      appBar: AppBar(
        title: const Text('Women Safety'),
        actions: [
          IconButton(
            icon: const Icon(Icons.notifications_outlined),
            onPressed: () {
              // Navigate to notifications
            },
          ),
        ],
      ),
      body: SafeArea(
        // ... rest of the body
        child: Column(
          children: [
            // Quick Stats Card
            Padding(
              padding: const EdgeInsets.all(16.0),
              child: Card(
                child: Padding(
                  padding: const EdgeInsets.all(16.0),
                  child: Row(
                    mainAxisAlignment: MainAxisAlignment.spaceAround,
                    children: [
                      _buildStatItem(
                        icon: Icons.shield,
                        label: 'Safe Zones',
                        value: '12',
                        color: AppColors.safe,
                      ),
                      _buildStatItem(
                        icon: Icons.warning,
                        label: 'Danger Zones',
                        value: '5',
                        color: AppColors.danger,
                      ),
                      _buildStatItem(
                        icon: Icons.people,
                        label: 'Volunteers',
                        value: '24',
                        color: AppColors.info,
                      ),
                    ],
                  ),
                ),
              ),
            ),

            const SizedBox(height: 20),

            // SOS Button - Made responsive
            Expanded(
              child: Center(
                child: SingleChildScrollView(
                  child: Column(
                    mainAxisAlignment: MainAxisAlignment.center,
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      GestureDetector(
                        onTap: () {
                          context.push('/sos');
                        },
                        child: LayoutBuilder(
                          builder: (context, constraints) {
                            // Responsive size: max 180, min 120
                            final screenWidth = MediaQuery.of(context).size.width;
                            final buttonSize = (screenWidth * 0.4).clamp(120.0, 180.0);
                            return Container(
                              width: buttonSize,
                              height: buttonSize,
                              decoration: BoxDecoration(
                                shape: BoxShape.circle,
                                color: AppColors.sosActive,
                                boxShadow: [
                                  BoxShadow(
                                    color: Color.fromRGBO(255, 23, 68, 0.4),
                                    blurRadius: 20,
                                    spreadRadius: 5,
                                  ),
                                ],
                              ),
                              child: Center(
                                child: Text(
                                  'SOS',
                                  style: TextStyle(
                                    color: Colors.white,
                                    fontSize: buttonSize * 0.24,
                                    fontWeight: FontWeight.bold,
                                    letterSpacing: 4,
                                  ),
                                ),
                              ),
                            );
                          },
                        ),
                      ),
                      const SizedBox(height: 16),
                      Text(
                        'Tap for Emergency',
                        style: Theme.of(context).textTheme.titleLarge,
                      ),
                      const SizedBox(height: 4),
                      Text(
                        'Or shake your phone',
                        style: Theme.of(context).textTheme.bodyMedium,
                      ),
                    ],
                  ),
                ),
              ),
            ),

            // Quick Actions
            Padding(
              padding: const EdgeInsets.all(16.0),
              child: Row(
                mainAxisAlignment: MainAxisAlignment.spaceEvenly,
                children: [
                  _buildQuickAction(
                    context,
                    icon: Icons.location_on,
                    label: 'Share Location',
                    onTap: () {
                      _updateLocation();
                      ScaffoldMessenger.of(context).showSnackBar(
                        const SnackBar(content: Text('Location shared manually')),
                      );
                    },
                  ),
                  _buildQuickAction(
                    context,
                    icon: Icons.phone,
                    label: 'Call Helpline',
                    onTap: () {
                      // Call helpline
                    },
                  ),
                  _buildQuickAction(
                    context,
                    icon: Icons.map,
                    label: 'View Map',
                    onTap: () {
                      context.push('/map');
                    },
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
      bottomNavigationBar: BottomNavigationBar(
        currentIndex: _selectedIndex,
        onTap: (index) {
          setState(() {
            _selectedIndex = index;
          });
          switch (index) {
            case 0:
              // Already on home
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
        items: const [
          BottomNavigationBarItem(
            icon: Icon(Icons.home),
            label: 'Home',
          ),
          BottomNavigationBarItem(
            icon: Icon(Icons.map),
            label: 'Map',
          ),
          BottomNavigationBarItem(
            icon: Icon(Icons.contacts),
            label: 'Contacts',
          ),
          BottomNavigationBarItem(
            icon: Icon(Icons.person),
            label: 'Profile',
          ),
        ],
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
        Icon(icon, color: color, size: 32),
        const SizedBox(height: 8),
        Text(
          value,
          style: TextStyle(
            fontSize: 20,
            fontWeight: FontWeight.bold,
            color: color,
          ),
        ),
        const SizedBox(height: 4),
        Text(
          label,
          style: const TextStyle(
            fontSize: 12,
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
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(12),
      child: Container(
        padding: const EdgeInsets.symmetric(vertical: 12, horizontal: 16),
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(12),
          border: Border.all(color: AppColors.disabled),
        ),
        child: Column(
          children: [
            Icon(icon, color: AppColors.primary),
            const SizedBox(height: 4),
            Text(
              label,
              style: const TextStyle(fontSize: 12),
            ),
          ],
        ),
      ),
    );
  }
}
