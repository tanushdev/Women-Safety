import 'dart:async';
import 'package:flutter/foundation.dart';
import 'package:permission_handler/permission_handler.dart';
import 'package:speech_to_text/speech_to_text.dart' as stt;
import 'package:vibration/vibration.dart';
import 'package:flutter_local_notifications/flutter_local_notifications.dart';

class VoiceTriggerService {
  static final VoiceTriggerService _instance = VoiceTriggerService._internal();
  factory VoiceTriggerService() => _instance;
  VoiceTriggerService._internal();

  final stt.SpeechToText _speech = stt.SpeechToText();
  final FlutterLocalNotificationsPlugin _notifications = FlutterLocalNotificationsPlugin();

  bool _isInitialized = false;
  bool _isListening = false;
  bool _isEnabled = false;
  Timer? _restartTimer;
  DateTime? _lastTriggerTime;

  // Distress trigger keywords (English + Hindi / regional)
  final List<String> _distressKeywords = [
    'help',
    'help me',
    'save me',
    'bachao',
    'bachao bachao',
    'emergency',
    'danger',
    'police',
    'chodo',
    'madad',
    'please help',
    'help please',
  ];

  // Callback to invoke when distress voice command is detected
  Function(String keyword)? onDistressDetected;
  ValueNotifier<bool> isListeningNotifier = ValueNotifier<bool>(false);
  ValueNotifier<String> lastHeardWords = ValueNotifier<String>('');

  bool get isEnabled => _isEnabled;
  bool get isListening => _isListening;

  Future<bool> init() async {
    if (_isInitialized) return true;

    try {
      // 1. Explicitly prompt user for Microphone permission
      final micStatus = await Permission.microphone.request();
      if (!micStatus.isGranted) {
        debugPrint('Microphone permission denied by user for VoiceTriggerService');
        return false;
      }

      _isInitialized = await _speech.initialize(
        onStatus: (status) {
          debugPrint('VoiceTrigger status: $status');
          _isListening = status == 'listening';
          isListeningNotifier.value = _isListening;

          // Auto-restart if still enabled and stopped
          if ((status == 'notListening' || status == 'done') && _isEnabled) {
            _scheduleRestart();
          }
        },
        onError: (errorNotification) {
          debugPrint('VoiceTrigger error: ${errorNotification.errorMsg}');
          if (_isEnabled) {
            _scheduleRestart();
          }
        },
      );

      // Initialize persistent notification so Android OS keeps process alive when screen is off
      const androidInit = AndroidInitializationSettings('@mipmap/ic_launcher');
      const initSettings = InitializationSettings(android: androidInit);
      await _notifications.initialize(initSettings);

      debugPrint('VoiceTriggerService initialized: $_isInitialized');
      return _isInitialized;
    } catch (e) {
      debugPrint('Failed to initialize VoiceTriggerService: $e');
      return false;
    }
  }

  void _scheduleRestart() {
    _restartTimer?.cancel();
    _restartTimer = Timer(const Duration(milliseconds: 600), () {
      if (_isEnabled) {
        _startListeningLoop();
      }
    });
  }

  Future<bool> startListening({Function(String keyword)? onTrigger}) async {
    if (onTrigger != null) {
      onDistressDetected = onTrigger;
    }
    _isEnabled = true;

    // Explicitly verify & prompt microphone permission
    final micStatus = await Permission.microphone.request();
    if (!micStatus.isGranted) {
      _isEnabled = false;
      _isListening = false;
      isListeningNotifier.value = false;
      debugPrint('Cannot start Voice Sentinel: Microphone permission not granted');
      return false;
    }

    if (!_isInitialized) {
      final success = await init();
      if (!success) {
        _isEnabled = false;
        _isListening = false;
        isListeningNotifier.value = false;
        debugPrint('Could not initialize speech recognition');
        return false;
      }
    }

    _showForegroundNotification();
    _startListeningLoop();
    return true;
  }

  Future<void> _startListeningLoop() async {
    if (!_isEnabled || !_isInitialized) return;
    if (_speech.isListening) return;

    try {
      await _speech.listen(
        onResult: (result) {
          final words = result.recognizedWords.toLowerCase().trim();
          lastHeardWords.value = words;
          debugPrint('Voice heard: "$words"');

          _checkKeywords(words);
        },
        listenOptions: stt.SpeechListenOptions(
          listenMode: stt.ListenMode.dictation,
          partialResults: true,
          cancelOnError: false,
        ),
        pauseFor: const Duration(seconds: 4),
      );
      _isListening = true;
      isListeningNotifier.value = true;
    } catch (e) {
      debugPrint('Error starting speech listening loop: $e');
      _scheduleRestart();
    }
  }

  void _checkKeywords(String heardText) {
    if (heardText.isEmpty) return;

    // Prevent duplicate triggers within 10 seconds
    final now = DateTime.now();
    if (_lastTriggerTime != null && now.difference(_lastTriggerTime!).inSeconds < 10) {
      return;
    }

    for (final keyword in _distressKeywords) {
      if (heardText.contains(keyword)) {
        _lastTriggerTime = now;
        debugPrint('🚨 EMERGENCY DISTRESS KEYWORD DETECTED: "$keyword"');

        // Strong emergency vibration pattern
        Vibration.hasVibrator().then((hasVib) {
          if (hasVib == true) {
            Vibration.vibrate(pattern: [0, 600, 200, 600, 200, 800]);
          }
        });

        // Trigger the emergency callback
        onDistressDetected?.call(keyword);
        break;
      }
    }
  }

  Future<void> stopListening() async {
    _isEnabled = false;
    _restartTimer?.cancel();
    try {
      await _speech.stop();
      _isListening = false;
      isListeningNotifier.value = false;
      await _notifications.cancel(8881);
    } catch (e) {
      debugPrint('Error stopping voice trigger: $e');
    }
  }

  Future<void> _showForegroundNotification() async {
    try {
      const androidDetails = AndroidNotificationDetails(
        'voice_shield_channel',
        'Voice Shield Sentinel',
        channelDescription: 'Monitors distress keywords ("Help", "Bachao") even when screen is locked',
        importance: Importance.low,
        priority: Priority.low,
        ongoing: true,
        autoCancel: false,
        showWhen: false,
      );
      const details = NotificationDetails(android: androidDetails);

      await _notifications.show(
        8881,
        '🛡️ Voice Shield Active',
        'Listening for distress words: "Help", "Bachao", "Emergency"',
        details,
      );
    } catch (e) {
      debugPrint('Error displaying voice shield notification: $e');
    }
  }
}
