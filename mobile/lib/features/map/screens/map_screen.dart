import 'package:flutter/material.dart';
import 'package:flutter_map/flutter_map.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:geolocator/geolocator.dart';
import 'package:latlong2/latlong.dart';
import '../../../shared/theme/app_theme.dart';
import '../../../core/config/app_config.dart';
import '../../../core/services/api_service.dart';

class MapScreen extends ConsumerStatefulWidget {
  const MapScreen({super.key});

  @override
  ConsumerState<MapScreen> createState() => _MapScreenState();
}

class _MapScreenState extends ConsumerState<MapScreen> {
  final MapController _mapController = MapController();
  LatLng? _currentLocation;
  bool _isLoading = true;
  bool _mapReady = false;
  List<Zone> _zones = [];
  bool _showSafeZones = true;
  bool _showDangerZones = true;

  @override
  void initState() {
    super.initState();
    _getCurrentLocation();
  }

  Future<void> _fetchZonesFromApi() async {
    try {
      final apiService = ref.read(apiServiceProvider);
      final response = await apiService.getZones();
      
      if (response.statusCode == 200) {
        final List<dynamic> zonesData = response.data;
        setState(() {
          _zones = zonesData.map((z) => Zone.fromJson(z)).toList();
        });
        debugPrint('Fetched ${_zones.length} zones from API');
      }
    } catch (e) {
      debugPrint('Error fetching zones: $e');
      // Keep any existing zones on error
    }
  }

  Future<void> _getCurrentLocation() async {
    try {
      final permission = await Geolocator.checkPermission();
      if (permission == LocationPermission.denied) {
        final result = await Geolocator.requestPermission();
        if (result == LocationPermission.denied) {
          setState(() => _isLoading = false);
          return;
        }
      }

      final position = await Geolocator.getCurrentPosition(
        desiredAccuracy: LocationAccuracy.high,
      );
      final location = LatLng(position.latitude, position.longitude);
      
      setState(() {
        _currentLocation = location;
        _isLoading = false;
      });

      // Fetch real zones from API
      await _fetchZonesFromApi();

      // Move map after a short delay to ensure it's ready
      Future.delayed(const Duration(milliseconds: 300), () {
        if (_mapReady && _currentLocation != null) {
          _mapController.move(_currentLocation!, 15);
        }
      });
    } catch (e) {
      debugPrint('Error getting location: $e');
      setState(() {
        _currentLocation = LatLng(18.9999, 73.1596);
        _isLoading = false;
      });
      // Still try to fetch zones
      await _fetchZonesFromApi();
    }
  }

  Color _getSeverityColor(String? severity) {
    switch (severity?.toLowerCase()) {
      case 'low':
        return Colors.green;
      case 'medium':
        return Colors.orange;
      case 'high':
        return Colors.red;
      case 'critical':
        return Colors.red.shade900;
      default:
        return Colors.orange;
    }
  }

  @override
  Widget build(BuildContext context) {
    // Filter zones based on toggle
    final filteredZones = _zones.where((zone) {
      if (zone.type == ZoneType.safe && !_showSafeZones) return false;
      if (zone.type == ZoneType.danger && !_showDangerZones) return false;
      return true;
    }).toList();

    return Scaffold(
      appBar: AppBar(
        title: const Text('Safety Map'),
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh),
            onPressed: _fetchZonesFromApi,
            tooltip: 'Refresh Zones',
          ),
          IconButton(
            icon: const Icon(Icons.my_location),
            onPressed: _currentLocation != null
                ? () => _mapController.move(_currentLocation!, 15)
                : null,
          ),
          IconButton(
            icon: const Icon(Icons.filter_list),
            onPressed: _showFilterDialog,
          ),
        ],
      ),
      body: _isLoading
          ? const Center(child: CircularProgressIndicator())
          : Stack(
              children: [
                FlutterMap(
                  mapController: _mapController,
                  options: MapOptions(
                    initialCenter: _currentLocation ?? LatLng(18.9999, 73.1596),
                    initialZoom: 15,
                    onMapReady: () {
                      setState(() => _mapReady = true);
                      if (_currentLocation != null) {
                        _mapController.move(_currentLocation!, 15);
                      }
                    },
                  ),
                  children: [
                    TileLayer(
                      urlTemplate: 'https://api.maptiler.com/maps/streets-v2/{z}/{x}/{y}@2x.png?key=${AppConfig.mapTilerApiKey}',
                      userAgentPackageName: 'com.example.women_safety_app',
                    ),
                    // Zone circles with severity-based colors
                    CircleLayer(
                      circles: filteredZones.map((zone) {
                        final color = zone.type == ZoneType.safe
                            ? AppColors.safe
                            : _getSeverityColor(zone.severity);
                        return CircleMarker(
                          point: zone.center,
                          radius: zone.radius / 10, // Scale for visibility
                          color: color.withOpacity(0.3),
                          borderColor: color,
                          borderStrokeWidth: 2,
                        );
                      }).toList(),
                    ),
                    // Current location marker
                    if (_currentLocation != null)
                      MarkerLayer(
                        markers: [
                          Marker(
                            point: _currentLocation!,
                            width: 40,
                            height: 40,
                            child: Container(
                              decoration: BoxDecoration(
                                color: AppColors.primary,
                                shape: BoxShape.circle,
                                border: Border.all(color: Colors.white, width: 3),
                                boxShadow: [
                                  BoxShadow(
                                    color: Colors.black.withOpacity(0.2),
                                    blurRadius: 8,
                                  ),
                                ],
                              ),
                              child: const Icon(
                                Icons.person,
                                color: Colors.white,
                                size: 20,
                              ),
                            ),
                          ),
                        ],
                      ),
                    // Zone markers
                    MarkerLayer(
                      markers: filteredZones.map((zone) {
                        final color = zone.type == ZoneType.safe
                            ? AppColors.safe
                            : _getSeverityColor(zone.severity);
                        return Marker(
                          point: zone.center,
                          width: 36,
                          height: 36,
                          child: GestureDetector(
                            onTap: () => _showZoneInfo(zone),
                            child: Container(
                              decoration: BoxDecoration(
                                color: color,
                                shape: BoxShape.circle,
                                border: Border.all(color: Colors.white, width: 2),
                                boxShadow: [
                                  BoxShadow(
                                    color: Colors.black.withOpacity(0.3),
                                    blurRadius: 4,
                                  ),
                                ],
                              ),
                              child: Icon(
                                zone.type == ZoneType.safe
                                    ? Icons.shield
                                    : Icons.warning,
                                color: Colors.white,
                                size: 18,
                              ),
                            ),
                          ),
                        );
                      }).toList(),
                    ),
                  ],
                ),
                // Legend with severity colors
                Positioned(
                  left: 16,
                  bottom: 16,
                  child: Card(
                    child: Padding(
                      padding: const EdgeInsets.all(12),
                      child: Column(
                        mainAxisSize: MainAxisSize.min,
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          const Text(
                            'Legend',
                            style: TextStyle(fontWeight: FontWeight.bold),
                          ),
                          const SizedBox(height: 8),
                          _legendItem(AppColors.safe, 'Safe Zone'),
                          const SizedBox(height: 4),
                          _legendItem(Colors.green, 'Low Risk'),
                          const SizedBox(height: 4),
                          _legendItem(Colors.orange, 'Medium Risk'),
                          const SizedBox(height: 4),
                          _legendItem(Colors.red, 'High Risk'),
                        ],
                      ),
                    ),
                  ),
                ),
                // Zone count badge
                Positioned(
                  right: 16,
                  bottom: 16,
                  child: Card(
                    color: AppColors.primary,
                    child: Padding(
                      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                      child: Text(
                        '${filteredZones.length} Zones',
                        style: const TextStyle(
                          color: Colors.white,
                          fontWeight: FontWeight.bold,
                        ),
                      ),
                    ),
                  ),
                ),
              ],
            ),
      floatingActionButton: FloatingActionButton.extended(
        onPressed: _reportZone,
        icon: const Icon(Icons.add_location),
        label: const Text('Report Zone'),
        backgroundColor: AppColors.primary,
      ),
    );
  }

  Widget _legendItem(Color color, String label) {
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        Container(
          width: 16,
          height: 16,
          decoration: BoxDecoration(
            color: color.withOpacity(0.3),
            border: Border.all(color: color),
            borderRadius: BorderRadius.circular(4),
          ),
        ),
        const SizedBox(width: 8),
        Text(label, style: const TextStyle(fontSize: 12)),
      ],
    );
  }

  void _showZoneInfo(Zone zone) {
    final color = zone.type == ZoneType.safe
        ? AppColors.safe
        : _getSeverityColor(zone.severity);
    
    showModalBottomSheet(
      context: context,
      builder: (context) => Container(
        padding: const EdgeInsets.all(24),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Container(
                  padding: const EdgeInsets.all(8),
                  decoration: BoxDecoration(
                    color: color.withOpacity(0.1),
                    shape: BoxShape.circle,
                  ),
                  child: Icon(
                    zone.type == ZoneType.safe ? Icons.shield : Icons.warning,
                    color: color,
                    size: 32,
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        zone.name,
                        style: const TextStyle(
                          fontSize: 20,
                          fontWeight: FontWeight.bold,
                        ),
                      ),
                      Row(
                        children: [
                          Container(
                            padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                            decoration: BoxDecoration(
                              color: color.withOpacity(0.2),
                              borderRadius: BorderRadius.circular(12),
                            ),
                            child: Text(
                              zone.type == ZoneType.safe 
                                  ? 'Safe Zone' 
                                  : '${zone.severity?.toUpperCase() ?? 'DANGER'} Risk',
                              style: TextStyle(
                                color: color,
                                fontSize: 12,
                                fontWeight: FontWeight.bold,
                              ),
                            ),
                          ),
                        ],
                      ),
                    ],
                  ),
                ),
              ],
            ),
            if (zone.description != null && zone.description!.isNotEmpty) ...[
              const SizedBox(height: 16),
              Text(
                zone.description!,
                style: const TextStyle(color: AppColors.textSecondary),
              ),
            ],
            const SizedBox(height: 12),
            Text(
              'Radius: ${zone.radius.toInt()} meters',
              style: const TextStyle(color: AppColors.textSecondary),
            ),
            const SizedBox(height: 24),
            Row(
              children: [
                Expanded(
                  child: OutlinedButton.icon(
                    onPressed: () => Navigator.pop(context),
                    icon: const Icon(Icons.directions),
                    label: const Text('Get Directions'),
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: ElevatedButton.icon(
                    onPressed: () => Navigator.pop(context),
                    icon: const Icon(Icons.share),
                    label: const Text('Share'),
                  ),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }

  void _showFilterDialog() {
    showDialog(
      context: context,
      builder: (context) => StatefulBuilder(
        builder: (context, setDialogState) => AlertDialog(
          title: const Text('Filter Zones'),
          content: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              CheckboxListTile(
                value: _showSafeZones,
                onChanged: (v) {
                  setDialogState(() => _showSafeZones = v ?? true);
                  setState(() {});
                },
                title: const Text('Safe Zones'),
                secondary: Icon(Icons.shield, color: AppColors.safe),
              ),
              CheckboxListTile(
                value: _showDangerZones,
                onChanged: (v) {
                  setDialogState(() => _showDangerZones = v ?? true);
                  setState(() {});
                },
                title: const Text('Danger Zones'),
                secondary: Icon(Icons.warning, color: AppColors.danger),
              ),
            ],
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(context),
              child: const Text('Close'),
            ),
          ],
        ),
      ),
    );
  }

  void _reportZone() {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      builder: (context) => Padding(
        padding: EdgeInsets.only(
          bottom: MediaQuery.of(context).viewInsets.bottom,
        ),
        child: Container(
          padding: const EdgeInsets.all(24),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const Text(
                'Report a Zone',
                style: TextStyle(
                  fontSize: 20,
                  fontWeight: FontWeight.bold,
                ),
              ),
              const SizedBox(height: 16),
              const TextField(
                decoration: InputDecoration(
                  labelText: 'Zone Name',
                  hintText: 'e.g., Dark Street Corner',
                ),
              ),
              const SizedBox(height: 16),
              const Text('Zone Type'),
              const SizedBox(height: 8),
              Row(
                children: [
                  Expanded(
                    child: OutlinedButton.icon(
                      onPressed: () {},
                      icon: Icon(Icons.shield, color: AppColors.safe),
                      label: const Text('Safe'),
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: OutlinedButton.icon(
                      onPressed: () {},
                      icon: Icon(Icons.warning, color: AppColors.danger),
                      label: const Text('Danger'),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 16),
              const TextField(
                decoration: InputDecoration(
                  labelText: 'Description (Optional)',
                  hintText: 'Why is this area safe/dangerous?',
                ),
                maxLines: 3,
              ),
              const SizedBox(height: 24),
              SizedBox(
                width: double.infinity,
                child: ElevatedButton(
                  onPressed: () {
                    Navigator.pop(context);
                    ScaffoldMessenger.of(context).showSnackBar(
                      const SnackBar(content: Text('Zone reported! Thank you.')),
                    );
                  },
                  child: const Text('Submit Report'),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

// Zone model with severity
enum ZoneType { safe, danger }

class Zone {
  final String id;
  final String name;
  final String? description;
  final ZoneType type;
  final String? severity;
  final LatLng center;
  final double radius;

  Zone({
    required this.id,
    required this.name,
    this.description,
    required this.type,
    this.severity,
    required this.center,
    required this.radius,
  });

  factory Zone.fromJson(Map<String, dynamic> json) {
    // Parse center coordinates from centerPoint.coordinates [lng, lat]
    final centerPoint = json['centerPoint'];
    double lat = 0, lng = 0;
    
    if (centerPoint != null && centerPoint['coordinates'] != null) {
      final coords = centerPoint['coordinates'];
      lng = (coords[0] as num).toDouble();
      lat = (coords[1] as num).toDouble();
    }

    // Parse zone type
    final typeStr = json['type']?.toString().toLowerCase() ?? 'danger';
    final zoneType = typeStr == 'safe' ? ZoneType.safe : ZoneType.danger;

    return Zone(
      id: json['_id'] ?? '',
      name: json['name'] ?? 'Unknown Zone',
      description: json['description'],
      type: zoneType,
      severity: json['severity'],
      center: LatLng(lat, lng),
      radius: (json['radius'] as num?)?.toDouble() ?? 500,
    );
  }
}
