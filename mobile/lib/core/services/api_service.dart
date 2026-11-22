import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../config/app_config.dart';

final dioProvider = Provider<Dio>((ref) {
  final dio = Dio(BaseOptions(
    baseUrl: AppConfig.apiBaseUrl,
    connectTimeout: AppConfig.connectTimeout,
    receiveTimeout: AppConfig.receiveTimeout,
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    },
  ));

  dio.interceptors.add(LogInterceptor(
    requestBody: true,
    responseBody: true,
  ));

  return dio;
});

final apiServiceProvider = Provider<ApiService>((ref) {
  return ApiService(ref.watch(dioProvider));
});

class ApiService {
  final Dio _dio;

  ApiService(this._dio);

  void setAuthToken(String token) {
    _dio.options.headers['Authorization'] = 'Bearer $token';
  }

  void clearAuthToken() {
    _dio.options.headers.remove('Authorization');
  }

  // Auth endpoints
  Future<Response> login(String phone) async {
    return _dio.post('/auth/login', data: {'phone': phone});
  }

  Future<Response> verifyOtp(String phone, String otp) async {
    return _dio.post('/auth/verify-otp', data: {'phone': phone, 'otp': otp});
  }

  Future<Response> register(String phone, String name, String? email) async {
    return _dio.post('/auth/register', data: {
      'phone': phone,
      'name': name,
      if (email != null) 'email': email,
    });
  }

  Future<Response> refreshToken(String refreshToken) async {
    return _dio.post('/auth/refresh', data: {'refreshToken': refreshToken});
  }

  Future<Response> logout() async {
    return _dio.post('/auth/logout');
  }

  Future<Response> deleteAccount() async {
    return _dio.delete('/users/me');
  }

  // User endpoints
  Future<Response> getProfile() async {
    return _dio.get('/users/me');
  }

  Future<Response> updateProfile(Map<String, dynamic> data) async {
    return _dio.patch('/users/me', data: data);
  }

  // Emergency contacts
  Future<Response> getEmergencyContacts() async {
    return _dio.get('/users/me/emergency-contacts');
  }

  Future<Response> updateEmergencyContacts(List<Map<String, dynamic>> contacts) async {
    return _dio.put('/users/me/emergency-contacts', data: {'contacts': contacts});
  }

  // SOS endpoints
  Future<Response> triggerSOS(Map<String, dynamic> data) async {
    return _dio.post('/sos', data: data);
  }

  Future<Response> cancelSOS(String sosId) async {
    return _dio.patch('/sos/$sosId/cancel');
  }

  Future<Response> updateSosLocation(String sosId, double latitude, double longitude) async {
    return _dio.patch('/sos/$sosId/location', data: {
      'latitude': latitude,
      'longitude': longitude,
    });
  }

  Future<Response> getActiveSOSEvents() async {
    return _dio.get('/sos/active');
  }

  // Zones
  Future<Response> getZones({double? lat, double? lng, double? radius}) async {
    final queryParams = <String, dynamic>{};
    if (lat != null) queryParams['lat'] = lat;
    if (lng != null) queryParams['lng'] = lng;
    if (radius != null) queryParams['radius'] = radius;
    return _dio.get('/zones', queryParameters: queryParams);
  }

  Future<Response> getNearbyZones(double lat, double lng, double radius) async {
    return _dio.get('/zones/nearby', queryParameters: {
      'lat': lat,
      'lng': lng,
      'radius': radius,
    });
  }

  // Volunteers
  Future<Response> getVolunteerProfile() async {
    return _dio.get('/volunteers/me');
  }

  Future<Response> registerAsVolunteer(Map<String, dynamic> data) async {
    return _dio.post('/volunteers/register', data: data);
  }

  Future<Response> updateVolunteerStatus(String status) async {
    return _dio.put('/volunteers/status', data: {'status': status});
  }

  Future<Response> updateVolunteerLocation(double latitude, double longitude) async {
    return _dio.put('/volunteers/location', data: {
      'latitude': latitude,
      'longitude': longitude,
    });
  }

  // User Location
  Future<Response> updateUserLocation(double latitude, double longitude) async {
    return _dio.patch('/users/location', data: {
      'coordinates': [longitude, latitude], // GeoJSON format: [lng, lat]
    });
  }

  // Get all users (for volunteer map)
  Future<Response> getAllUsers() async {
    return _dio.get('/users');
  }

  // Dashboard Stats
  Future<Response> getDashboardStats() async {
    return _dio.get('/users/dashboard-stats');
  }

  // Notifications
  Future<Response> getNotifications() async {
    return _dio.get('/notifications');
  }

  // Journey Guard
  Future<Response> startJourney(Map<String, dynamic> data) async {
    return _dio.post('/journey/start', data: data);
  }

  Future<Response> updateJourneyLocation(String shareToken, double lat, double lng) async {
    return _dio.patch('/journey/location/$shareToken', data: {
      'coordinates': [lng, lat],
    });
  }

  Future<Response> markJourneyArrived(String shareToken) async {
    return _dio.post('/journey/arrive/$shareToken');
  }

  // Reports
  Future<Response> createIncidentReport(Map<String, dynamic> data) async {
    return _dio.post('/reports/incident', data: data);
  }

  // Incident History
  Future<Response> getMyIncidentHistory() async {
    return _dio.get('/sos/my-history');
  }

  // Dead Man Switch
  Future<Response> armDeadMansSwitch(int durationMinutes) async {
    return _dio.post('/sos/deadmans-switch', data: {'durationMinutes': durationMinutes});
  }
}
