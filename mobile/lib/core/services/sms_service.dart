import 'package:flutter/foundation.dart';
import 'package:flutter/services.dart';
import 'package:hive_flutter/hive_flutter.dart';
import 'package:geolocator/geolocator.dart';
import 'package:url_launcher/url_launcher.dart';
import '../config/app_config.dart';

class SMSService {
  static final SMSService _instance = SMSService._internal();
  factory SMSService() => _instance;
  SMSService._internal();

  static const MethodChannel _nativeChannel = MethodChannel('com.women_safety.app/native_security');

  Future<void> init() async {
    debugPrint('SMSService initialized with Offline Direct SIM Support');
  }

  Future<void> sendSOSMessages(List<String> phones, String message) async {
    for (final phone in phones) {
      await sendDirectOfflineSMS(phone: phone, message: message);
    }
  }

  /// Sends emergency SMS directly via SIM card without needing internet connection
  Future<bool> sendDirectOfflineSMS({
    required String phone,
    required String message,
  }) async {
    try {
      final bool? success = await _nativeChannel.invokeMethod<bool>('sendDirectSMS', {
        'phone': phone,
        'message': message,
      });
      debugPrint('Direct SMS dispatched to $phone: $success');
      return success ?? false;
    } catch (e) {
      debugPrint('Direct SMS failed, falling back to SMS URI: $e');
      try {
        final uri = Uri.parse('sms:$phone?body=${Uri.encodeComponent(message)}');
        if (await canLaunchUrl(uri)) {
          await launchUrl(uri);
          return true;
        }
      } catch (launchErr) {
        debugPrint('SMS URI fallback error: $launchErr');
      }
      return false;
    }
  }

  /// Broadcasts emergency SOS to all offline contacts stored in Hive
  Future<int> broadcastOfflineSOS({Position? position}) async {
    int sentCount = 0;
    try {
      // Get current location if not supplied
      Position? loc = position;
      if (loc == null) {
        try {
          loc = await Geolocator.getCurrentPosition(
            desiredAccuracy: LocationAccuracy.high,
            timeLimit: const Duration(seconds: 4),
          );
        } catch (_) {
          loc = await Geolocator.getLastKnownPosition();
        }
      }

      final String mapLink = loc != null
          ? 'https://maps.google.com/?q=${loc.latitude},${loc.longitude}'
          : 'Location unavailable';

      final String distressMessage =
          '🚨 EMERGENCY SOS! I am in immediate danger and have no internet. Live coordinates: $mapLink (Sent via Offline Guardian SMS)';

      // Retrieve cached contacts from local storage
      List<String> contactPhones = [];
      if (Hive.isBoxOpen(AppConfig.hiveBoxContacts)) {
        final box = Hive.box(AppConfig.hiveBoxContacts);
        final cached = box.get('emergency_contacts', defaultValue: []);
        if (cached is List) {
          for (final c in cached) {
            if (c is Map && c['phone'] != null) {
              contactPhones.add(c['phone'].toString());
            }
          }
        }
      }

      // Default emergency helplines if no contacts cached
      if (contactPhones.isEmpty) {
        contactPhones.add('112'); // National Emergency Number
      }

      for (final phone in contactPhones) {
        final ok = await sendDirectOfflineSMS(phone: phone, message: distressMessage);
        if (ok) sentCount++;
      }

      debugPrint('Offline SOS sent to $sentCount/${contactPhones.length} contacts');
    } catch (e) {
      debugPrint('Error in broadcastOfflineSOS: $e');
    }
    return sentCount;
  }
}
