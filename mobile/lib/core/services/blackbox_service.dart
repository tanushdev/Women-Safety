import 'dart:async';
import 'dart:io';
import 'dart:convert';
import 'package:crypto/crypto.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter/services.dart';
import 'package:geolocator/geolocator.dart';
import 'package:hive_flutter/hive_flutter.dart';

class BlackboxIncident {
  final String id;
  final DateTime timestamp;
  final String audioPath;
  final String sha256Checksum;
  final String digitalCertificate;
  final double latitude;
  final double longitude;
  final bool isSynced;

  BlackboxIncident({
    required this.id,
    required this.timestamp,
    required this.audioPath,
    required this.sha256Checksum,
    required this.digitalCertificate,
    required this.latitude,
    required this.longitude,
    this.isSynced = false,
  });

  Map<String, dynamic> toJson() => {
        'id': id,
        'timestamp': timestamp.toIso8601String(),
        'audioPath': audioPath,
        'sha256Checksum': sha256Checksum,
        'digitalCertificate': digitalCertificate,
        'latitude': latitude,
        'longitude': longitude,
        'isSynced': isSynced,
      };

  factory BlackboxIncident.fromJson(Map<String, dynamic> json) => BlackboxIncident(
        id: json['id'] ?? '',
        timestamp: DateTime.parse(json['timestamp']),
        audioPath: json['audioPath'] ?? '',
        sha256Checksum: json['sha256Checksum'] ?? '',
        digitalCertificate: json['digitalCertificate'] ?? '',
        latitude: (json['latitude'] as num?)?.toDouble() ?? 0.0,
        longitude: (json['longitude'] as num?)?.toDouble() ?? 0.0,
        isSynced: json['isSynced'] ?? false,
      );
}

class BlackboxService {
  static final BlackboxService _instance = BlackboxService._internal();
  factory BlackboxService() => _instance;
  BlackboxService._internal();

  static const MethodChannel _nativeChannel = MethodChannel('com.women_safety.app/native_security');
  bool _isRecording = false;
  Timer? _autoStopTimer;

  bool get isRecording => _isRecording;
  final ValueNotifier<bool> isRecordingNotifier = ValueNotifier<bool>(false);
  final ValueNotifier<List<BlackboxIncident>> evidenceVaultNotifier = ValueNotifier<List<BlackboxIncident>>([]);

  Future<void> init() async {
    await _loadStoredIncidents();
  }

  Future<void> _loadStoredIncidents() async {
    try {
      final box = await Hive.openBox('blackbox_vault');
      final list = box.get('incidents', defaultValue: []);
      if (list is List) {
        evidenceVaultNotifier.value = list
            .map((item) => BlackboxIncident.fromJson(Map<String, dynamic>.from(item as Map)))
            .toList();
      }
    } catch (e) {
      debugPrint('Error loading Blackbox incidents: $e');
    }
  }

  Future<void> _saveIncident(BlackboxIncident incident) async {
    try {
      final box = await Hive.openBox('blackbox_vault');
      final current = List<BlackboxIncident>.from(evidenceVaultNotifier.value);
      current.insert(0, incident);
      evidenceVaultNotifier.value = current;

      await box.put('incidents', current.map((i) => i.toJson()).toList());
      debugPrint('Blackbox incident saved with SHA-256 seal: ${incident.digitalCertificate}');
    } catch (e) {
      debugPrint('Error saving Blackbox incident: $e');
    }
  }

  /// Automatically arms and records a 25-second tamper-evident Blackbox package during an emergency
  Future<String?> startBlackboxCapture({
    Duration duration = const Duration(seconds: 25),
    Function(BlackboxIncident)? onSealed,
  }) async {
    if (_isRecording) return null;

    try {
      final String? path = await _nativeChannel.invokeMethod<String>('startBlackboxRecording');
      _isRecording = true;
      isRecordingNotifier.value = true;
      debugPrint('🎙️ Blackbox audio recording started: $path');

      // Automatically seal package when duration expires
      _autoStopTimer?.cancel();
      _autoStopTimer = Timer(duration, () async {
        final incident = await stopAndSealBlackbox();
        if (incident != null && onSealed != null) {
          onSealed(incident);
        }
      });

      return path;
    } catch (e) {
      debugPrint('Failed to start Blackbox recording: $e');
      _isRecording = false;
      isRecordingNotifier.value = false;
      return null;
    }
  }

  /// Stops recording, computes SHA-256 cryptographic checksum, and seals evidence
  Future<BlackboxIncident?> stopAndSealBlackbox() async {
    if (!_isRecording) return null;
    _autoStopTimer?.cancel();

    try {
      final String? audioPath = await _nativeChannel.invokeMethod<String>('stopBlackboxRecording');
      _isRecording = false;
      isRecordingNotifier.value = false;

      if (audioPath == null || !File(audioPath).existsSync()) {
        debugPrint('Blackbox file not found on disk');
        return null;
      }

      final fileBytes = await File(audioPath).readAsBytes();
      final sha256Digest = sha256.convert(fileBytes).toString();
      final digitalCert = 'CERT_WS_${sha256Digest.substring(0, 16).toUpperCase()}';

      // Capture GPS location
      Position? loc;
      try {
        loc = await Geolocator.getCurrentPosition(
          desiredAccuracy: LocationAccuracy.high,
          timeLimit: const Duration(seconds: 3),
        );
      } catch (_) {
        loc = await Geolocator.getLastKnownPosition();
      }

      final incident = BlackboxIncident(
        id: 'BB_${DateTime.now().millisecondsSinceEpoch}',
        timestamp: DateTime.now(),
        audioPath: audioPath,
        sha256Checksum: sha256Digest,
        digitalCertificate: digitalCert,
        latitude: loc?.latitude ?? 0.0,
        longitude: loc?.longitude ?? 0.0,
      );

      await _saveIncident(incident);
      return incident;
    } catch (e) {
      debugPrint('Error sealing Blackbox package: $e');
      _isRecording = false;
      isRecordingNotifier.value = false;
      return null;
    }
  }
}
