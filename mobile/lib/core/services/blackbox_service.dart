import 'dart:async';
import 'dart:io';
import 'dart:convert';
import 'package:crypto/crypto.dart';
import 'package:dio/dio.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter/services.dart';
import 'package:geolocator/geolocator.dart';
import 'package:hive_flutter/hive_flutter.dart';
import 'package:permission_handler/permission_handler.dart';
import '../config/app_config.dart';

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
  String? _lastRecordedAudioPath;

  bool get isRecording => _isRecording;
  String? get lastRecordedAudioPath => _lastRecordedAudioPath;
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

  /// Automatically arms and records tamper-evident Blackbox audio from phone microphone (full 25 seconds)
  Future<String?> startBlackboxCapture({
    Duration duration = const Duration(seconds: 25),
    Function(BlackboxIncident)? onSealed,
  }) async {
    if (_isRecording) return _lastRecordedAudioPath;

    try {
      // 1. Explicitly prompt user for Microphone permission
      final micStatus = await Permission.microphone.request();
      if (!micStatus.isGranted) {
        debugPrint('⚠️ Microphone permission denied: $micStatus');
        return null;
      }

      final String? path = await _nativeChannel.invokeMethod<String>('startBlackboxRecording');
      _isRecording = true;
      _lastRecordedAudioPath = path;
      isRecordingNotifier.value = true;
      debugPrint('🎙️ Real phone microphone audio recording started at: $path');

      // Automatically stop and seal package when duration expires
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

  /// Stops recording from microphone, computes SHA-256 cryptographic checksum, and seals evidence
  Future<BlackboxIncident?> stopAndSealBlackbox() async {
    if (!_isRecording) return null;
    _autoStopTimer?.cancel();

    try {
      final String? audioPath = await _nativeChannel.invokeMethod<String>('stopBlackboxRecording');
      _isRecording = false;
      isRecordingNotifier.value = false;

      final resolvedPath = audioPath ?? _lastRecordedAudioPath;
      if (resolvedPath == null || !File(resolvedPath).existsSync()) {
        debugPrint('Blackbox audio file not found on disk: $resolvedPath');
        return null;
      }

      _lastRecordedAudioPath = resolvedPath;
      final fileBytes = await File(resolvedPath).readAsBytes();
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
        audioPath: resolvedPath,
        sha256Checksum: sha256Digest,
        digitalCertificate: digitalCert,
        latitude: loc?.latitude ?? 0.0,
        longitude: loc?.longitude ?? 0.0,
      );

      await _saveIncident(incident);
      debugPrint('🎙️ Real audio captured and sealed (${fileBytes.length} bytes, SHA-256: $sha256Digest)');
      return incident;
    } catch (e) {
      debugPrint('Error sealing Blackbox package: $e');
      _isRecording = false;
      isRecordingNotifier.value = false;
      return null;
    }
  }

  /// Uploads real audio recording file to the backend server
  Future<bool> uploadBlackboxAudio(String sosId, {String? filePath}) async {
    try {
      final targetPath = filePath ?? _lastRecordedAudioPath ?? (evidenceVaultNotifier.value.isNotEmpty ? evidenceVaultNotifier.value.first.audioPath : null);
      if (targetPath == null) {
        debugPrint('⚠️ No blackbox audio path found to upload');
        return false;
      }

      final file = File(targetPath);
      if (!file.existsSync()) {
        debugPrint('⚠️ Blackbox audio file does not exist on disk: $targetPath');
        return false;
      }

      final fileBytes = await file.readAsBytes();
      if (fileBytes.isEmpty) {
        debugPrint('⚠️ Blackbox audio file is 0 bytes, skipping upload');
        return false;
      }

      final base64Audio = base64Encode(fileBytes);
      final sha256Digest = sha256.convert(fileBytes).toString();

      debugPrint('📤 Uploading real phone audio (${fileBytes.length} bytes, SHA-256: ${sha256Digest.substring(0, 8)}...) to SOS $sosId');

      final dio = Dio(BaseOptions(
        connectTimeout: const Duration(seconds: 20),
        receiveTimeout: const Duration(seconds: 20),
        headers: {
          'Content-Type': 'application/json',
          'ngrok-skip-browser-warning': 'true',
        },
      ));

      Response? res;
      try {
        res = await dio.post(
          '${AppConfig.apiBaseUrl}/media/evidence/$sosId/audio',
          data: {
            'base64': base64Audio,
            'duration': 25,
            'filename': 'phone_mic_${sosId}_${DateTime.now().millisecondsSinceEpoch}.m4a',
            'sha256Checksum': sha256Digest,
          },
        );
      } catch (e) {
        debugPrint('Media upload route error ($e), trying direct /sos/$sosId/audio route...');
        res = await dio.post(
          '${AppConfig.apiBaseUrl}/sos/$sosId/audio',
          data: {
            'base64': base64Audio,
            'duration': 25,
            'filename': 'phone_mic_${sosId}_${DateTime.now().millisecondsSinceEpoch}.m4a',
            'sha256Checksum': sha256Digest,
          },
        );
      }

      if (res.statusCode == 200 || res.statusCode == 201) {
        debugPrint('✅ Real phone audio successfully uploaded to backend for SOS $sosId');
        return true;
      }
      return false;
    } catch (e) {
      debugPrint('❌ Failed to upload real phone audio: $e');
      return false;
    }
  }
}
