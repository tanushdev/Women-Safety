class AppConfig {
  // App Information
  static const String appName = 'Women Safety';
  static const String appVersion = '1.0.0';

  // API Configuration
  // API Configuration
  // FOR PHYSICAL DEVICE WITH ADB:
  // 1. Run in terminal: adb reverse tcp:3000 tcp:3000
  // 2. This maps phone's localhost to PC's localhost
  static const String apiBaseUrl = 'https://bb9227d1b5e5.ngrok-free.app/api/v1';
  static const String socketUrl = 'https://bb9227d1b5e5.ngrok-free.app';

  // API Timeouts
  static const Duration connectTimeout = Duration(seconds: 30);
  static const Duration receiveTimeout = Duration(seconds: 30);

  // Location Configuration
  static const Duration locationUpdateInterval = Duration(seconds: 5);
  static const double locationAccuracyMeters = 10.0;

  // SOS Configuration
  static const Duration audioRecordingDuration = Duration(seconds: 20);
  static const int shakeSensitivity = 15; // Shake force threshold
  static const int powerButtonPressCount = 3; // Number of rapid presses
  static const Duration powerButtonTimeWindow = Duration(seconds: 2);

  // Red Zone Configuration
  static const Duration redZoneInactivityThreshold = Duration(minutes: 10);

  // WebSocket Configuration
  static const Duration socketReconnectDelay = Duration(seconds: 3);
  static const int socketMaxReconnectAttempts = 5;

  // Local Storage
  static const String hiveBoxAuth = 'auth_box';
  static const String hiveBoxUser = 'user_box';
  static const String hiveBoxContacts = 'contacts_box';
  static const String hiveBoxSettings = 'settings_box';

  // Map Configuration
  static const double defaultMapZoom = 15.0;
  static const double dangerZoneOpacity = 0.3;
  static const double safeZoneOpacity = 0.2;
  static const String mapTilerApiKey = '99UPBxc3swngBNuvD3HJ';

  // Mock Data (for development)
  static const bool useMockData = false;
}
