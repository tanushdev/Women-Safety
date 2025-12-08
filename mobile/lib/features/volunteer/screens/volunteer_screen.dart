import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:geolocator/geolocator.dart';
import 'package:url_launcher/url_launcher.dart';
import 'package:flutter_map/flutter_map.dart';
import 'package:latlong2/latlong.dart';
import '../../../shared/theme/app_theme.dart';
import '../../../core/services/api_service.dart';
import '../../../shared/providers/user_provider.dart';
import 'package:go_router/go_router.dart';

class VolunteerScreen extends ConsumerStatefulWidget {
  const VolunteerScreen({super.key});

  @override
  ConsumerState<VolunteerScreen> createState() => _VolunteerScreenState();
}

class _VolunteerScreenState extends ConsumerState<VolunteerScreen> {
  bool _isLoading = true;
  bool _isRegistered = false;
  bool _isApproved = false;
  bool _isAvailable = false;
  Map<String, dynamic>? _volunteerData;
  Timer? _locationTimer;
  Timer? _alertsTimer;
  int _selectedTab = 0; // 0 = Alerts, 1 = Map
  
  // My location
  Position? _myPosition;
  
  // Map controller to move map after location is fetched
  final MapController _mapController = MapController();
  
  // Active SOS alerts
  List<Map<String, dynamic>> _nearbyAlerts = [];
  bool _loadingAlerts = false;
  
  // All users for map display
  List<Map<String, dynamic>> _allUsers = [];
  
  // Registration form
  final _formKey = GlobalKey<FormState>();
  final _governmentIdController = TextEditingController();
  final List<String> _selectedSkills = [];
  final List<String> _selectedLanguages = [];
  String _bio = '';
  int _responseDistance = 5; // km

  final List<String> _availableSkills = [
    'First Aid',
    'Self Defense',
    'Counseling',
    'Medical',
    'Legal Aid',
    'Driving',
  ];

  final List<String> _availableLanguages = [
    'Hindi',
    'English',
    'Marathi',
    'Gujarati',
    'Tamil',
    'Telugu',
  ];

  @override
  void initState() {
    super.initState();
    _checkVolunteerStatus();
    _updateLocationOnce(); // Update location immediately when screen opens
  }

  Future<void> _updateLocationOnce() async {
    try {
      final position = await Geolocator.getCurrentPosition();
      setState(() {
        _myPosition = position;
      });
      
      // Move map to my location
      try {
        _mapController.move(
          LatLng(position.latitude, position.longitude),
          14,
        );
      } catch (_) {
        // Map controller might not be ready yet
      }
      
      final apiService = ref.read(apiServiceProvider);
      // Update both volunteer and user location
      await Future.wait([
        apiService.updateVolunteerLocation(position.latitude, position.longitude),
        apiService.updateUserLocation(position.latitude, position.longitude),
      ]);
      debugPrint('Initial volunteer location set: ${position.latitude}, ${position.longitude}');
      
      // Also fetch all users for the map
      _fetchAllUsers();
    } catch (e) {
      debugPrint('Failed to set initial location: $e');
    }
  }

  Future<void> _fetchAllUsers() async {
    try {
      final apiService = ref.read(apiServiceProvider);
      final response = await apiService.getAllUsers();
      if (response.statusCode == 200 && response.data != null) {
        final List<dynamic> users = response.data is List ? response.data : [];
        setState(() {
          _allUsers = users.cast<Map<String, dynamic>>();
        });
        debugPrint('Fetched ${_allUsers.length} users for map');
      }
    } catch (e) {
      debugPrint('Failed to fetch users: $e');
    }
  }

  @override
  void dispose() {
    _locationTimer?.cancel();
    _alertsTimer?.cancel();
    _governmentIdController.dispose();
    super.dispose();
  }

  Future<void> _checkVolunteerStatus() async {
    try {
      final apiService = ref.read(apiServiceProvider);
      final response = await apiService.getVolunteerProfile();
      
      debugPrint('Volunteer profile response: ${response.statusCode}');
      debugPrint('Volunteer profile data: ${response.data}');
      debugPrint('Volunteer profile data type: ${response.data?.runtimeType}');
      
      if (response.statusCode == 200 && response.data != null) {
        // Handle various response formats
        Map<String, dynamic>? data;
        
        if (response.data is Map<String, dynamic>) {
          data = response.data as Map<String, dynamic>;
        } else if (response.data is Map) {
          data = Map<String, dynamic>.from(response.data as Map);
        }
        
        if (data != null && (data.containsKey('_id') || data.containsKey('verificationStatus'))) {
          final verificationStatus = data['verificationStatus']?.toString().toLowerCase() ?? '';
          final status = data['status']?.toString().toLowerCase() ?? '';
          
          debugPrint('Verification status: $verificationStatus');
          debugPrint('Status: $status');
          
          final approved = verificationStatus == 'verified';

          setState(() {
            _volunteerData = data;
            _isRegistered = true;
            _isApproved = approved;
            _isAvailable = status == 'available';
          });
          
          if (_isApproved) {
            // Refresh User Provider to update global role
            ref.read(userProvider.notifier).fetchProfile();
            
            _startLocationUpdates();
            _fetchNearbyAlerts();
            _startAlertsPolling();
          }
        } else {
          debugPrint('No valid volunteer data found');
        }
      }
    } catch (e) {
      debugPrint('Volunteer check error: $e');
    } finally {
      if (mounted) {
        setState(() => _isLoading = false);
      }
    }
  }

  void _startLocationUpdates() {
    _locationTimer = Timer.periodic(const Duration(seconds: 30), (_) async {
      if (!_isAvailable) return;
      
      try {
        final position = await Geolocator.getCurrentPosition();
        final apiService = ref.read(apiServiceProvider);
        // Update both volunteer location AND user location
        await Future.wait([
          apiService.updateVolunteerLocation(position.latitude, position.longitude),
          apiService.updateUserLocation(position.latitude, position.longitude),
        ]);
        debugPrint('Volunteer location updated: ${position.latitude}, ${position.longitude}');
      } catch (e) {
        debugPrint('Location update error: $e');
      }
    });
  }

  void _startAlertsPolling() {
    _alertsTimer = Timer.periodic(const Duration(seconds: 10), (_) {
      if (_isAvailable) {
        _fetchNearbyAlerts();
      }
    });
  }

  Future<void> _fetchNearbyAlerts() async {
    if (_loadingAlerts) return;
    
    setState(() => _loadingAlerts = true);
    
    try {
      final apiService = ref.read(apiServiceProvider);
      final response = await apiService.getActiveSOSEvents();
      
      if (response.statusCode == 200 && response.data != null) {
        final List alerts = response.data is List ? response.data : response.data['data'] ?? [];
        setState(() {
          _nearbyAlerts = alerts.map((a) => a as Map<String, dynamic>).toList();
        });
      }
    } catch (e) {
      debugPrint('Fetch alerts error: $e');
    } finally {
      setState(() => _loadingAlerts = false);
    }
  }

  Future<void> _registerAsVolunteer() async {
    if (!_formKey.currentState!.validate()) return;
    
    if (_governmentIdController.text.trim().isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Please enter your Government ID'),
          backgroundColor: Colors.red,
        ),
      );
      return;
    }
    
    setState(() => _isLoading = true);
    
    try {
      final apiService = ref.read(apiServiceProvider);
      await apiService.registerAsVolunteer({
        'governmentId': _governmentIdController.text.trim().toUpperCase(),
        'skills': _selectedSkills,
        'languages': _selectedLanguages,
        'maxResponseDistance': _responseDistance * 1000,
        'bio': _bio,
      });
      
      setState(() {
        _isRegistered = true;
        _isApproved = false;
      });
      
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Registration submitted! Waiting for admin approval.'),
            backgroundColor: Colors.green,
          ),
        );
      }
    } catch (e) {
      debugPrint('Registration error: $e');
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Registration failed: ${e.toString()}'),
            backgroundColor: Colors.red,
          ),
        );
      }
    } finally {
      setState(() => _isLoading = false);
    }
  }

  Future<void> _toggleAvailability() async {
    final newStatus = _isAvailable ? 'offline' : 'available';
    
    try {
      final apiService = ref.read(apiServiceProvider);
      await apiService.updateVolunteerStatus(newStatus);
      
      setState(() => _isAvailable = !_isAvailable);
      
      if (_isAvailable) {
        _startLocationUpdates();
        _startAlertsPolling();
        _fetchNearbyAlerts();
      } else {
        _locationTimer?.cancel();
        _alertsTimer?.cancel();
      }
    } catch (e) {
      debugPrint('Status update error: $e');
    }
  }

  void _openMapsNavigation(double lat, double lng) async {
    final url = Uri.parse('https://www.google.com/maps/dir/?api=1&destination=$lat,$lng');
    if (await canLaunchUrl(url)) {
      await launchUrl(url, mode: LaunchMode.externalApplication);
    }
  }

  void _callUser(String? phone) async {
    if (phone == null) return;
    final url = Uri.parse('tel:$phone');
    if (await canLaunchUrl(url)) {
      await launchUrl(url);
    }
  }

  @override
  Widget build(BuildContext context) {
    if (_isLoading) {
      return Scaffold(
        appBar: AppBar(title: const Text('Volunteer')),
        body: const Center(child: CircularProgressIndicator()),
      );
    }

    if (_isRegistered && _isApproved) {
      return _buildVolunteerDashboard();
    }

    if (_isRegistered && !_isApproved) {
      return _buildPendingApproval();
    }

    return _buildRegistrationForm();
  }

  Widget _buildVolunteerDashboard() {
    return Scaffold(
      appBar: AppBar(
        title: Text(_selectedTab == 0 ? 'Volunteer Dashboard' : 'Live Map'),
        backgroundColor: AppColors.primary,
        foregroundColor: Colors.white,
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh),
            onPressed: _fetchNearbyAlerts,
          ),
          IconButton(
            icon: const Icon(Icons.person),
            onPressed: () => context.push('/profile'),
          ),
        ],
      ),
      body: Column(
        children: [
          // Status Toggle
          Container(
            width: double.infinity,
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(
              color: _isAvailable ? Colors.green.shade50 : Colors.grey.shade100,
              border: Border(
                bottom: BorderSide(
                  color: _isAvailable ? Colors.green : Colors.grey,
                  width: 2,
                ),
              ),
            ),
            child: Row(
              children: [
                Icon(
                  _isAvailable ? Icons.radio_button_checked : Icons.radio_button_off,
                  color: _isAvailable ? Colors.green : Colors.grey,
                  size: 28,
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        _isAvailable ? 'AVAILABLE' : 'OFFLINE',
                        style: TextStyle(
                          fontSize: 16,
                          fontWeight: FontWeight.bold,
                          color: _isAvailable ? Colors.green.shade700 : Colors.grey.shade700,
                        ),
                      ),
                      Text(
                        _isAvailable ? 'Receiving alerts' : 'Not receiving alerts',
                        style: TextStyle(fontSize: 12, color: Colors.grey.shade600),
                      ),
                    ],
                  ),
                ),
                Switch(
                  value: _isAvailable,
                  onChanged: (_) => _toggleAvailability(),
                  activeColor: Colors.green,
                ),
              ],
            ),
          ),
          
          // Content based on selected tab
          Expanded(
            child: _selectedTab == 0 ? _buildAlertsTab() : _buildMapTab(),
          ),
        ],
      ),
      bottomNavigationBar: BottomNavigationBar(
        currentIndex: _selectedTab,
        onTap: (index) {
          setState(() {
            _selectedTab = index;
          });
        },
        selectedItemColor: AppColors.primary,
        items: const [
          BottomNavigationBarItem(
            icon: Icon(Icons.warning_amber),
            label: 'Alerts',
          ),
          BottomNavigationBarItem(
            icon: Icon(Icons.map),
            label: 'Map',
          ),
        ],
      ),
    );
  }

  Widget _buildAlertsTab() {
    return _nearbyAlerts.isEmpty
        ? _buildNoAlerts()
        : RefreshIndicator(
            onRefresh: _fetchNearbyAlerts,
            child: ListView.builder(
              padding: const EdgeInsets.all(16),
              itemCount: _nearbyAlerts.length + 1,
              itemBuilder: (context, index) {
                if (index == 0) {
                  return Padding(
                    padding: const EdgeInsets.only(bottom: 12),
                    child: Row(
                      children: [
                        Icon(Icons.warning_amber, color: Colors.red.shade700),
                        const SizedBox(width: 8),
                        Text(
                          'Active Alerts (${_nearbyAlerts.length})',
                          style: const TextStyle(
                            fontSize: 18,
                            fontWeight: FontWeight.bold,
                          ),
                        ),
                      ],
                    ),
                  );
                }
                return _buildAlertCard(_nearbyAlerts[index - 1]);
              },
            ),
          );
  }

  Widget _buildMapTab() {
    // Default center - use my position if available
    LatLng center = _myPosition != null 
        ? LatLng(_myPosition!.latitude, _myPosition!.longitude)
        : const LatLng(20.5937, 78.9629);
    
    // If we have alerts, center on the first one
    if (_nearbyAlerts.isNotEmpty) {
      final firstAlert = _nearbyAlerts.first;
      final location = firstAlert['location'];
      if (location != null) {
        final coords = location['coordinates'];
        if (coords != null && coords is List && coords.length >= 2) {
          center = LatLng(coords[1].toDouble(), coords[0].toDouble());
        }
      }
    }

    return Stack(
      children: [
        FlutterMap(
          mapController: _mapController,
          options: MapOptions(
            initialCenter: center,
            initialZoom: 14,
          ),
          children: [
            TileLayer(
              urlTemplate: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
              userAgentPackageName: 'com.women_safety_app',
            ),
            MarkerLayer(
              markers: _buildMapMarkers(),
            ),
          ],
        ),
        // Legend
        Positioned(
          bottom: 16,
          left: 16,
          child: Container(
            padding: const EdgeInsets.all(12),
            decoration: BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.circular(8),
              boxShadow: [BoxShadow(color: Colors.black26, blurRadius: 4)],
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisSize: MainAxisSize.min,
              children: [
                _buildLegendItem(Colors.blue, 'You'),
                const SizedBox(height: 4),
                _buildLegendItem(Colors.red, 'SOS Alert'),
                const SizedBox(height: 4),
                _buildLegendItem(Colors.green, 'User'),
              ],
            ),
          ),
        ),
        // Refresh button
        Positioned(
          top: 16,
          right: 16,
          child: FloatingActionButton.small(
            onPressed: () {
              _updateLocationOnce();
              _fetchNearbyAlerts();
            },
            child: const Icon(Icons.refresh),
          ),
        ),
      ],
    );
  }

  Widget _buildLegendItem(Color color, String label) {
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        Container(
          width: 12,
          height: 12,
          decoration: BoxDecoration(
            color: color,
            shape: BoxShape.circle,
          ),
        ),
        const SizedBox(width: 6),
        Text(label, style: const TextStyle(fontSize: 12)),
      ],
    );
  }

  List<Marker> _buildMapMarkers() {
    List<Marker> markers = [];
    
    // Add MY location marker (BLUE)
    if (_myPosition != null) {
      markers.add(
        Marker(
          point: LatLng(_myPosition!.latitude, _myPosition!.longitude),
          width: 60,
          height: 60,
          child: Column(
            children: [
              Container(
                padding: const EdgeInsets.all(6),
                decoration: BoxDecoration(
                  color: Colors.blue,
                  borderRadius: BorderRadius.circular(25),
                  border: Border.all(color: Colors.white, width: 3),
                  boxShadow: [
                    BoxShadow(
                      color: Colors.blue.withOpacity(0.5),
                      blurRadius: 12,
                      spreadRadius: 3,
                    ),
                  ],
                ),
                child: const Icon(
                  Icons.person,
                  color: Colors.white,
                  size: 22,
                ),
              ),
              const Text(
                'You',
                style: TextStyle(
                  fontSize: 10,
                  fontWeight: FontWeight.bold,
                  color: Colors.blue,
                ),
              ),
            ],
          ),
        ),
      );
    }
    
    // Add SOS alert markers (RED)
    for (final alert in _nearbyAlerts) {
      final location = alert['location'];
      if (location != null) {
        final coords = location['coordinates'];
        if (coords != null && coords is List && coords.length >= 2) {
          final lat = coords[1].toDouble();
          final lng = coords[0].toDouble();
          final userName = alert['user']?['name'] ?? 'Unknown';
          
          markers.add(
            Marker(
              point: LatLng(lat, lng),
              width: 60,
              height: 60,
              child: GestureDetector(
                onTap: () => _showAlertDetails(alert),
                child: Column(
                  children: [
                    Container(
                      padding: const EdgeInsets.all(6),
                      decoration: BoxDecoration(
                        color: Colors.red,
                        borderRadius: BorderRadius.circular(25),
                        boxShadow: [
                          BoxShadow(
                            color: Colors.red.withOpacity(0.5),
                            blurRadius: 12,
                            spreadRadius: 3,
                          ),
                        ],
                      ),
                      child: const Icon(
                        Icons.warning,
                        color: Colors.white,
                        size: 22,
                      ),
                    ),
                    Text(
                      userName,
                      style: const TextStyle(
                        fontSize: 10,
                        fontWeight: FontWeight.bold,
                        color: Colors.red,
                      ),
                      overflow: TextOverflow.ellipsis,
                    ),
                  ],
                ),
              ),
            ),
          );
        }
      }
    }
    
    // Add all users markers (GREEN)
    for (final user in _allUsers) {
      // Try both 'lastLocation' and 'location' field names
      final location = user['lastLocation'] ?? user['location'];
      if (location != null) {
        final coords = location['coordinates'];
        if (coords != null && coords is List && coords.length >= 2) {
          final lat = (coords[1] as num).toDouble();
          final lng = (coords[0] as num).toDouble();
          // Skip if at 0,0 (no real location)
          if (lat == 0 && lng == 0) continue;
          
          final userName = user['name'] ?? 'User';
          
          markers.add(
            Marker(
              point: LatLng(lat, lng),
              width: 50,
              height: 50,
              child: Column(
                children: [
                  Container(
                    padding: const EdgeInsets.all(4),
                    decoration: BoxDecoration(
                      color: Colors.green,
                      borderRadius: BorderRadius.circular(20),
                      border: Border.all(color: Colors.white, width: 2),
                      boxShadow: [
                        BoxShadow(
                          color: Colors.green.withOpacity(0.4),
                          blurRadius: 6,
                          spreadRadius: 1,
                        ),
                      ],
                    ),
                    child: const Icon(
                      Icons.person_pin,
                      color: Colors.white,
                      size: 18,
                    ),
                  ),
                  Text(
                    userName,
                    style: const TextStyle(
                      fontSize: 9,
                      fontWeight: FontWeight.bold,
                      color: Colors.green,
                    ),
                    overflow: TextOverflow.ellipsis,
                  ),
                ],
              ),
            ),
          );
        }
      }
    }
    
    
    return markers;
  }

  void _showAlertDetails(Map<String, dynamic> alert) {
    final userName = alert['user']?['name'] ?? 'Unknown';
    final phone = alert['user']?['phone'] ?? '';
    final location = alert['location'];
    double? lat, lng;
    
    if (location != null) {
      final coords = location['coordinates'];
      if (coords != null && coords is List && coords.length >= 2) {
        lat = coords[1].toDouble();
        lng = coords[0].toDouble();
      }
    }

    showModalBottomSheet(
      context: context,
      builder: (context) => Container(
        padding: const EdgeInsets.all(20),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                const Icon(Icons.warning, color: Colors.red, size: 30),
                const SizedBox(width: 12),
                Expanded(
                  child: Text(
                    'SOS Alert: $userName',
                    style: const TextStyle(
                      fontSize: 20,
                      fontWeight: FontWeight.bold,
                    ),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 16),
            if (phone.isNotEmpty)
              ListTile(
                leading: const Icon(Icons.phone),
                title: Text(phone),
                onTap: () => _callUser(phone),
              ),
            if (lat != null && lng != null)
              ListTile(
                leading: const Icon(Icons.directions),
                title: const Text('Navigate to Location'),
                onTap: () => _openMaps(lat!, lng!),
              ),
            const SizedBox(height: 16),
            SizedBox(
              width: double.infinity,
              child: ElevatedButton.icon(
                onPressed: () {
                  Navigator.pop(context);
                  if (phone.isNotEmpty) _callUser(phone);
                },
                icon: const Icon(Icons.call),
                label: const Text('Call User'),
                style: ElevatedButton.styleFrom(
                  backgroundColor: Colors.green,
                  foregroundColor: Colors.white,
                  padding: const EdgeInsets.all(16),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Future<void> _openMaps(double lat, double lng) async {
    final url = Uri.parse('https://www.google.com/maps/dir/?api=1&destination=$lat,$lng');
    if (await canLaunchUrl(url)) {
      await launchUrl(url, mode: LaunchMode.externalApplication);
    }
  }

  Widget _buildNoAlerts() {
    return Center(
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Icon(
            _isAvailable ? Icons.check_circle_outline : Icons.notifications_off,
            size: 80,
            color: Colors.grey.shade400,
          ),
          const SizedBox(height: 16),
          Text(
            _isAvailable ? 'No Active Alerts' : 'You are Offline',
            style: TextStyle(
              fontSize: 20,
              fontWeight: FontWeight.bold,
              color: Colors.grey.shade600,
            ),
          ),
          const SizedBox(height: 8),
          Text(
            _isAvailable 
                ? 'You will be notified when someone nearby needs help'
                : 'Turn on availability to receive alerts',
            textAlign: TextAlign.center,
            style: TextStyle(color: Colors.grey.shade500),
          ),
          if (_loadingAlerts) ...[
            const SizedBox(height: 24),
            const CircularProgressIndicator(),
          ],
        ],
      ),
    );
  }

  Widget _buildAlertCard(Map<String, dynamic> alert) {
    final user = alert['userId'];
    final userName = user?['name'] ?? 'Unknown User';
    final userPhone = user?['phone'];
    final status = alert['status'] ?? 'TRIGGERED';
    final createdAt = alert['createdAt'] != null 
        ? DateTime.tryParse(alert['createdAt']) 
        : null;
    
    // Get location
    double? lat, lng;
    final currentLoc = alert['currentLocation'];
    final initialLoc = alert['initialLocation'];
    
    if (currentLoc != null && currentLoc['coordinates'] != null) {
      lng = (currentLoc['coordinates'][0] as num?)?.toDouble();
      lat = (currentLoc['coordinates'][1] as num?)?.toDouble();
    } else if (initialLoc != null && initialLoc['coordinates'] != null) {
      lng = (initialLoc['coordinates'][0] as num?)?.toDouble();
      lat = (initialLoc['coordinates'][1] as num?)?.toDouble();
    }
    
    final timeSince = createdAt != null 
        ? _formatTimeSince(createdAt) 
        : 'Just now';

    return Container(
      margin: const EdgeInsets.only(bottom: 16),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: Colors.red.shade300, width: 2),
        boxShadow: [
          BoxShadow(
            color: Colors.red.withOpacity(0.1),
            blurRadius: 10,
            offset: const Offset(0, 4),
          ),
        ],
      ),
      child: Column(
        children: [
          // Header
          Container(
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(
              color: Colors.red.shade50,
              borderRadius: const BorderRadius.vertical(top: Radius.circular(14)),
            ),
            child: Row(
              children: [
                Container(
                  padding: const EdgeInsets.all(10),
                  decoration: BoxDecoration(
                    color: Colors.red.shade100,
                    shape: BoxShape.circle,
                  ),
                  child: Icon(Icons.warning, color: Colors.red.shade700, size: 24),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        'EMERGENCY ALERT',
                        style: TextStyle(
                          fontSize: 12,
                          fontWeight: FontWeight.bold,
                          color: Colors.red.shade700,
                          letterSpacing: 1,
                        ),
                      ),
                      const SizedBox(height: 2),
                      Text(
                        timeSince,
                        style: TextStyle(fontSize: 12, color: Colors.grey.shade600),
                      ),
                    ],
                  ),
                ),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                  decoration: BoxDecoration(
                    color: status == 'TRIGGERED' ? Colors.red : Colors.orange,
                    borderRadius: BorderRadius.circular(20),
                  ),
                  child: Text(
                    status,
                    style: const TextStyle(
                      color: Colors.white,
                      fontSize: 12,
                      fontWeight: FontWeight.bold,
                    ),
                  ),
                ),
              ],
            ),
          ),
          
          // User Info
          Padding(
            padding: const EdgeInsets.all(16),
            child: Column(
              children: [
                Row(
                  children: [
                    CircleAvatar(
                      radius: 28,
                      backgroundColor: Colors.purple.shade100,
                      child: Text(
                        userName.isNotEmpty ? userName[0].toUpperCase() : '?',
                        style: TextStyle(
                          fontSize: 24,
                          fontWeight: FontWeight.bold,
                          color: Colors.purple.shade700,
                        ),
                      ),
                    ),
                    const SizedBox(width: 16),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            userName,
                            style: const TextStyle(
                              fontSize: 18,
                              fontWeight: FontWeight.bold,
                            ),
                          ),
                          if (userPhone != null) ...[
                            const SizedBox(height: 4),
                            Text(
                              userPhone,
                              style: TextStyle(
                                fontSize: 14,
                                color: Colors.grey.shade600,
                              ),
                            ),
                          ],
                        ],
                      ),
                    ),
                  ],
                ),
                
                if (lat != null && lng != null) ...[
                  const SizedBox(height: 12),
                  Container(
                    padding: const EdgeInsets.all(12),
                    decoration: BoxDecoration(
                      color: Colors.grey.shade100,
                      borderRadius: BorderRadius.circular(8),
                    ),
                    child: Row(
                      children: [
                        Icon(Icons.location_on, color: Colors.red.shade400, size: 20),
                        const SizedBox(width: 8),
                        Expanded(
                          child: Text(
                            '${lat.toStringAsFixed(6)}, ${lng.toStringAsFixed(6)}',
                            style: TextStyle(
                              fontFamily: 'monospace',
                              fontSize: 13,
                              color: Colors.grey.shade700,
                            ),
                          ),
                        ),
                      ],
                    ),
                  ),
                ],
              ],
            ),
          ),
          
          // Action Buttons
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 0, 16, 16),
            child: Row(
              children: [
                if (userPhone != null)
                  Expanded(
                    child: OutlinedButton.icon(
                      onPressed: () => _callUser(userPhone),
                      icon: const Icon(Icons.phone),
                      label: const Text('Call'),
                      style: OutlinedButton.styleFrom(
                        foregroundColor: Colors.green,
                        side: const BorderSide(color: Colors.green),
                        padding: const EdgeInsets.symmetric(vertical: 12),
                      ),
                    ),
                  ),
                if (userPhone != null) const SizedBox(width: 12),
                Expanded(
                  flex: 2,
                  child: ElevatedButton.icon(
                    onPressed: lat != null && lng != null 
                        ? () => _openMapsNavigation(lat!, lng!)
                        : null,
                    icon: const Icon(Icons.navigation),
                    label: const Text('Navigate'),
                    style: ElevatedButton.styleFrom(
                      backgroundColor: Colors.blue,
                      foregroundColor: Colors.white,
                      padding: const EdgeInsets.symmetric(vertical: 12),
                    ),
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  String _formatTimeSince(DateTime time) {
    final diff = DateTime.now().difference(time);
    if (diff.inMinutes < 1) return 'Just now';
    if (diff.inMinutes < 60) return '${diff.inMinutes} min ago';
    if (diff.inHours < 24) return '${diff.inHours} hours ago';
    return '${diff.inDays} days ago';
  }

  Widget _buildPendingApproval() {
    return Scaffold(
      appBar: AppBar(title: const Text('Volunteer Status')),
      body: Center(
        child: Padding(
          padding: const EdgeInsets.all(32),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Container(
                padding: const EdgeInsets.all(24),
                decoration: BoxDecoration(
                  color: Colors.orange.shade50,
                  shape: BoxShape.circle,
                ),
                child: Icon(Icons.hourglass_top, size: 64, color: Colors.orange.shade700),
              ),
              const SizedBox(height: 24),
              const Text(
                'Pending Approval',
                style: TextStyle(fontSize: 24, fontWeight: FontWeight.bold),
              ),
              const SizedBox(height: 12),
              Text(
                'Your volunteer registration is under review.\nYou will receive a notification once approved.',
                textAlign: TextAlign.center,
                style: TextStyle(color: Colors.grey.shade600, fontSize: 16),
              ),
              const SizedBox(height: 32),
              OutlinedButton.icon(
                onPressed: () {
                  setState(() => _isLoading = true);
                  _checkVolunteerStatus();
                },
                icon: const Icon(Icons.refresh),
                label: const Text('Check Status'),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildRegistrationForm() {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Become a Volunteer'),
        backgroundColor: AppColors.primary,
        foregroundColor: Colors.white,
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(16),
        child: Form(
          key: _formKey,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              // Header
              Container(
                padding: const EdgeInsets.all(20),
                decoration: BoxDecoration(
                  gradient: LinearGradient(
                    colors: [AppColors.primary, AppColors.primary.withOpacity(0.8)],
                  ),
                  borderRadius: BorderRadius.circular(16),
                ),
                child: const Column(
                  children: [
                    Icon(Icons.volunteer_activism, size: 48, color: Colors.white),
                    SizedBox(height: 12),
                    Text(
                      'Join as a Government Volunteer',
                      style: TextStyle(
                        fontSize: 20,
                        fontWeight: FontWeight.bold,
                        color: Colors.white,
                      ),
                    ),
                    SizedBox(height: 8),
                    Text(
                      'Help people in your area during emergencies',
                      style: TextStyle(color: Colors.white70),
                      textAlign: TextAlign.center,
                    ),
                  ],
                ),
              ),
              
              const SizedBox(height: 24),
              
              // Skills
              const Text('Skills', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 16)),
              const SizedBox(height: 8),
              Wrap(
                spacing: 8,
                runSpacing: 8,
                children: _availableSkills.map((skill) {
                  final selected = _selectedSkills.contains(skill);
                  return FilterChip(
                    label: Text(skill),
                    selected: selected,
                    onSelected: (value) {
                      setState(() {
                        if (value) {
                          _selectedSkills.add(skill);
                        } else {
                          _selectedSkills.remove(skill);
                        }
                      });
                    },
                    selectedColor: AppColors.primary.withOpacity(0.2),
                    checkmarkColor: AppColors.primary,
                  );
                }).toList(),
              ),
              
              const SizedBox(height: 20),
              
              // Languages
              const Text('Languages', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 16)),
              const SizedBox(height: 8),
              Wrap(
                spacing: 8,
                runSpacing: 8,
                children: _availableLanguages.map((lang) {
                  final selected = _selectedLanguages.contains(lang);
                  return FilterChip(
                    label: Text(lang),
                    selected: selected,
                    onSelected: (value) {
                      setState(() {
                        if (value) {
                          _selectedLanguages.add(lang);
                        } else {
                          _selectedLanguages.remove(lang);
                        }
                      });
                    },
                    selectedColor: AppColors.primary.withOpacity(0.2),
                    checkmarkColor: AppColors.primary,
                  );
                }).toList(),
              ),
              
              const SizedBox(height: 20),
              
              // Response Distance
              Text(
                'Response Distance: $_responseDistance km',
                style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 16),
              ),
              Slider(
                value: _responseDistance.toDouble(),
                min: 1,
                max: 10,
                divisions: 9,
                label: '$_responseDistance km',
                onChanged: (value) {
                  setState(() => _responseDistance = value.round());
                },
              ),
              
              const SizedBox(height: 20),
              
              // Government ID (Required)
              const Text('Government ID *', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 16)),
              const SizedBox(height: 8),
              TextFormField(
                controller: _governmentIdController,
                textCapitalization: TextCapitalization.characters,
                decoration: InputDecoration(
                  labelText: 'Your Unique ID',
                  hintText: 'e.g., PLC4321, GOV1234',
                  border: const OutlineInputBorder(),
                  prefixIcon: const Icon(Icons.badge),
                  helperText: 'Enter your official government volunteer ID',
                  filled: true,
                  fillColor: Colors.grey.shade50,
                ),
                validator: (value) {
                  if (value == null || value.trim().isEmpty) {
                    return 'Government ID is required';
                  }
                  return null;
                },
              ),
              
              const SizedBox(height: 16),
              
              // Bio
              TextFormField(
                decoration: const InputDecoration(
                  labelText: 'About You (Optional)',
                  hintText: 'Brief description about your background...',
                  border: OutlineInputBorder(),
                ),
                maxLines: 2,
                onChanged: (value) => _bio = value,
              ),
              
              const SizedBox(height: 24),
              
              // Submit Button
              ElevatedButton(
                onPressed: _isLoading ? null : _registerAsVolunteer,
                style: ElevatedButton.styleFrom(
                  backgroundColor: AppColors.primary,
                  foregroundColor: Colors.white,
                  padding: const EdgeInsets.symmetric(vertical: 16),
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(12),
                  ),
                ),
                child: _isLoading
                    ? const SizedBox(
                        height: 20,
                        width: 20,
                        child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2),
                      )
                    : const Text(
                        'Submit Registration',
                        style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold),
                      ),
              ),
              
              const SizedBox(height: 16),
              
              Text(
                'Your registration will be reviewed by admin before approval.',
                textAlign: TextAlign.center,
                style: TextStyle(color: Colors.grey.shade600, fontSize: 12),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
