import 'package:flutter/foundation.dart';

/// SMS Service - SMS is sent via backend using Twilio
/// The mobile app triggers SOS which notifies backend
/// Backend then sends SMS to emergency contacts via Twilio
class SMSService {
  static final SMSService _instance = SMSService._internal();
  factory SMSService() => _instance;
  SMSService._internal();

  Future<void> init() async {
    // No initialization needed - SMS is handled by backend
    debugPrint('SMSService: SMS will be sent via backend (Twilio)');
  }

  Future<void> sendSOSMessages(List<String> phones, String message) async {
    // SMS is automatically sent by backend when SOS is created
    // This is just a placeholder for compatibility
    debugPrint('SMSService: ${phones.length} contacts will be notified via backend');
  }
}
