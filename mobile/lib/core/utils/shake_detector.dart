import 'dart:async';
import 'dart:math';
import 'package:sensors_plus/sensors_plus.dart';

/// A utility class to detect device shakes using the accelerometer.
class ShakeDetector {
  /// The callback to be executed when a shake is detected.
  final Function() onPhoneShake;

  /// The threshold for shake detection (g-force).
  final double shakeThresholdGravity;

  /// The minimum time between shake detections (milliseconds).
  final int shakeSlopTimeMS;

  /// The time to reset the shake count (milliseconds).
  final int shakeCountResetTime;

  /// The minimum number of shakes required to trigger the callback.
  final int minimumShakeCount;

  int _shakeCount = 0;
  int _lastShakeTimestamp = 0;
  StreamSubscription? _streamSubscription;

  ShakeDetector({
    required this.onPhoneShake,
    this.shakeThresholdGravity = 2.7,
    this.shakeSlopTimeMS = 500,
    this.shakeCountResetTime = 3000,
    this.minimumShakeCount = 1,
  });

  /// Starts listening to accelerometer events.
  void startListening() {
    _streamSubscription = accelerometerEventStream().listen((AccelerometerEvent event) {
      double gX = event.x / 9.80665;
      double gY = event.y / 9.80665;
      double gZ = event.z / 9.80665;

      // gForce will be close to 1 when there is no movement.
      double gForce = sqrt(gX * gX + gY * gY + gZ * gZ);

      if (gForce > shakeThresholdGravity) {
        var now = DateTime.now().millisecondsSinceEpoch;
        
        // Ignore shakes that are too close to each other
        if (_lastShakeTimestamp + shakeSlopTimeMS > now) {
          return;
        }

        // Reset the shake count if it's been too long since the last shake
        if (_lastShakeTimestamp + shakeCountResetTime < now) {
          _shakeCount = 0;
        }

        _lastShakeTimestamp = now;
        _shakeCount++;

        if (_shakeCount >= minimumShakeCount) {
          onPhoneShake();
          _shakeCount = 0; // Reset after triggering
        }
      }
    });
  }

  /// Stops listening to accelerometer events.
  void stopListening() {
    _streamSubscription?.cancel();
  }
}
