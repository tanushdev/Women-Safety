import 'dart:async';
import 'package:flutter/foundation.dart';
import 'package:flutter/services.dart';
import 'package:geolocator/geolocator.dart';
import 'package:permission_handler/permission_handler.dart';
import 'package:vibration/vibration.dart';

class RadarResult {
  final bool success;
  final String? message;
  RadarResult({required this.success, this.message});
}

class Sighting {
  final DateTime time;
  final double latitude;
  final double longitude;
  final int rssi;

  Sighting({
    required this.time,
    required this.latitude,
    required this.longitude,
    required this.rssi,
  });
}

class SuspectFollower {
  final String deviceId;
  final String name;
  final List<Sighting> sightings;
  final double distanceTraveledMeters;
  final Duration trackingDuration;

  SuspectFollower({
    required this.deviceId,
    required this.name,
    required this.sightings,
    required this.distanceTraveledMeters,
    required this.trackingDuration,
  });
}

class StalkerRadarService {
  static final StalkerRadarService _instance = StalkerRadarService._internal();
  factory StalkerRadarService() => _instance;
  StalkerRadarService._internal();

  static const MethodChannel _nativeChannel = MethodChannel('com.women_safety.app/native_security');

  bool _isMonitoring = false;
  Timer? _periodicScanTimer;

  // History of sightings per device: Map<deviceId, List<Sighting>>
  final Map<String, List<Sighting>> _deviceHistory = {};
  final Map<String, String> _deviceNames = {};

  bool get isMonitoring => _isMonitoring;
  final ValueNotifier<bool> isMonitoringNotifier = ValueNotifier<bool>(false);
  final ValueNotifier<List<SuspectFollower>> activeAlertsNotifier = ValueNotifier<List<SuspectFollower>>([]);
  final ValueNotifier<int> nearbyDevicesCountNotifier = ValueNotifier<int>(0);

  Function(SuspectFollower alert)? onStalkerDetected;

  Future<bool> isBluetoothEnabled() async {
    try {
      final bool? isEnabled = await _nativeChannel.invokeMethod<bool>('isBluetoothEnabled');
      return isEnabled ?? false;
    } catch (_) {
      return false;
    }
  }

  Future<RadarResult> startRadar({
    Duration scanInterval = const Duration(seconds: 45),
    Function(SuspectFollower alert)? onAlert,
  }) async {
    // 1. Check & Request Permissions at Runtime
    final Map<Permission, PermissionStatus> statuses = await [
      Permission.bluetoothScan,
      Permission.bluetoothConnect,
      Permission.location,
    ].request();

    final bool permissionsGranted = (statuses[Permission.bluetoothScan]?.isGranted == true ||
                                     statuses[Permission.bluetoothConnect]?.isGranted == true ||
                                     statuses[Permission.location]?.isGranted == true);

    if (!permissionsGranted) {
      _isMonitoring = false;
      isMonitoringNotifier.value = false;
      debugPrint('Bluetooth / Location permissions denied for Stalker Radar');
      return RadarResult(
        success: false,
        message: 'Bluetooth & Location permissions are required for Stalker Radar.',
      );
    }

    // 2. Check if the device's physical Bluetooth hardware is turned ON
    final bool btOn = await isBluetoothEnabled();
    if (!btOn) {
      _isMonitoring = false;
      isMonitoringNotifier.value = false;
      debugPrint('Physical Bluetooth adapter is turned OFF');
      return RadarResult(
        success: false,
        message: 'Bluetooth is turned OFF. Please turn on Bluetooth in device settings to use Stalker Radar.',
      );
    }

    if (_isMonitoring) return RadarResult(success: true);
    if (onAlert != null) onStalkerDetected = onAlert;

    _isMonitoring = true;
    isMonitoringNotifier.value = true;
    debugPrint('📡 Bluetooth Stalker Radar activated');

    // Run first scan immediately
    await _performRadarScan();

    // Schedule periodic scanning
    _periodicScanTimer?.cancel();
    _periodicScanTimer = Timer.periodic(scanInterval, (_) async {
      if (_isMonitoring) {
        await _performRadarScan();
      }
    });

    return RadarResult(success: true);
  }

  Future<void> stopRadar() async {
    _isMonitoring = false;
    isMonitoringNotifier.value = false;
    _periodicScanTimer?.cancel();
    debugPrint('Bluetooth Stalker Radar paused');
  }

  Future<void> _performRadarScan() async {
    try {
      final List<dynamic>? results =
          await _nativeChannel.invokeListMethod<dynamic>('scanNearbyBluetooth');

      if (results == null) return;
      nearbyDevicesCountNotifier.value = results.length;

      // Get current position
      Position? currentLoc;
      try {
        currentLoc = await Geolocator.getCurrentPosition(
          desiredAccuracy: LocationAccuracy.medium,
          timeLimit: const Duration(seconds: 3),
        );
      } catch (_) {
        currentLoc = await Geolocator.getLastKnownPosition();
      }

      final now = DateTime.now();
      final double lat = currentLoc?.latitude ?? 0.0;
      final double lng = currentLoc?.longitude ?? 0.0;

      // Prune records older than 30 minutes
      _deviceHistory.removeWhere((_, list) {
        list.removeWhere((s) => now.difference(s.time).inMinutes > 30);
        return list.isEmpty;
      });

      final List<SuspectFollower> detectedSuspects = [];

      for (final item in results) {
        if (item is! Map) continue;
        final String deviceId = item['id']?.toString() ?? 'UNKNOWN';
        final String name = item['name']?.toString() ?? 'BLE Device';
        final int rssi = (item['rssi'] as num?)?.toInt() ?? -100;

        _deviceNames[deviceId] = name;

        if (!_deviceHistory.containsKey(deviceId)) {
          _deviceHistory[deviceId] = [];
        }

        _deviceHistory[deviceId]!.add(Sighting(
          time: now,
          latitude: lat,
          longitude: lng,
          rssi: rssi,
        ));

        // Evaluate co-traveling:
        // Must be seen in at least 3 distinct scans
        final sightings = _deviceHistory[deviceId]!;
        if (sightings.length >= 3 && lat != 0.0 && lng != 0.0) {
          final first = sightings.first;
          final last = sightings.last;

          final duration = last.time.difference(first.time);

          // Calculate displacement between first and last sighting
          final distance = Geolocator.distanceBetween(
            first.latitude,
            first.longitude,
            last.latitude,
            last.longitude,
          );

          // If tracking user across >150 meters over >3 minutes:
          if (distance > 150 && duration.inMinutes >= 3) {
            final suspect = SuspectFollower(
              deviceId: deviceId,
              name: name,
              sightings: sightings,
              distanceTraveledMeters: distance,
              trackingDuration: duration,
            );
            detectedSuspects.add(suspect);
          }
        }
      }

      activeAlertsNotifier.value = detectedSuspects;

      if (detectedSuspects.isNotEmpty) {
        final topSuspect = detectedSuspects.first;
        debugPrint(
            '⚠️ STALKER RADAR WARNING: Device ${topSuspect.deviceId} has followed you for ${topSuspect.distanceTraveledMeters.toStringAsFixed(0)}m over ${topSuspect.trackingDuration.inMinutes} mins');

        // Discrete double haptic warning
        Vibration.hasVibrator().then((hasVib) {
          if (hasVib == true) {
            Vibration.vibrate(pattern: [0, 400, 200, 400]);
          }
        });

        onStalkerDetected?.call(topSuspect);
      }
    } catch (e) {
      debugPrint('Error performing Stalker Radar scan: $e');
    }
  }
}
