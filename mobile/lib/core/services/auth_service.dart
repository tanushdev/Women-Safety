import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'api_service.dart';

// Auth state
class AuthState {
  final bool isAuthenticated;
  final bool isLoading;
  final String? userId;
  final String? userName;
  final String? phone;
  final String? accessToken;
  final String? error;

  const AuthState({
    this.isAuthenticated = false,
    this.isLoading = false,
    this.userId,
    this.userName,
    this.phone,
    this.accessToken,
    this.error,
  });

  AuthState copyWith({
    bool? isAuthenticated,
    bool? isLoading,
    String? userId,
    String? userName,
    String? phone,
    String? accessToken,
    String? error,
  }) {
    return AuthState(
      isAuthenticated: isAuthenticated ?? this.isAuthenticated,
      isLoading: isLoading ?? this.isLoading,
      userId: userId ?? this.userId,
      userName: userName ?? this.userName,
      phone: phone ?? this.phone,
      accessToken: accessToken ?? this.accessToken,
      error: error,
    );
  }
}

// Auth notifier
class AuthNotifier extends StateNotifier<AuthState> {
  final ApiService _apiService;

  AuthNotifier(this._apiService) : super(const AuthState()) {
    _loadStoredAuth();
  }

  Future<void> _loadStoredAuth() async {
    state = state.copyWith(isLoading: true);
    try {
      final prefs = await SharedPreferences.getInstance();
      final token = prefs.getString('accessToken');
      final userId = prefs.getString('userId');
      final userName = prefs.getString('userName');
      final phone = prefs.getString('phone');

      if (token != null && userId != null) {
        _apiService.setAuthToken(token);
        state = AuthState(
          isAuthenticated: true,
          userId: userId,
          userName: userName,
          phone: phone,
          accessToken: token,
        );
      } else {
        state = const AuthState();
      }
    } catch (e) {
      state = const AuthState();
    }
  }

  Future<bool> login(String phone) async {
    state = state.copyWith(isLoading: true, error: null);
    try {
      final response = await _apiService.login(phone);
      final data = response.data;

      final accessToken = data['accessToken'] as String;
      final refreshToken = data['refreshToken'] as String;
      final user = data['user'] as Map<String, dynamic>;
      final userId = user['_id'] ?? user['id'];

      // Save to storage
      final prefs = await SharedPreferences.getInstance();
      await prefs.setString('accessToken', accessToken);
      await prefs.setString('refreshToken', refreshToken);
      await prefs.setString('userId', userId);
      await prefs.setString('userName', user['name'] ?? '');
      await prefs.setString('phone', user['phone']);

      // Set auth token for API calls
      _apiService.setAuthToken(accessToken);

      state = AuthState(
        isAuthenticated: true,
        userId: userId,
        userName: user['name'],
        phone: user['phone'],
        accessToken: accessToken,
      );

      return true;
    } catch (e) {
      print('Login Error: $e'); // Log error for debugging
      state = state.copyWith(
        isLoading: false,
        error: 'Login failed. Please try again.',
      );
      return false;
    }
  }

  Future<void> logout() async {
    try {
      await _apiService.logout();
    } catch (_) {}

    _apiService.clearAuthToken();

    final prefs = await SharedPreferences.getInstance();
    await prefs.remove('accessToken');
    await prefs.remove('refreshToken');
    await prefs.remove('userId');
    await prefs.remove('userName');
    await prefs.remove('phone');

    state = const AuthState();
  }

  void clearError() {
    state = state.copyWith(error: null);
  }
}

// Providers
final authProvider = StateNotifierProvider<AuthNotifier, AuthState>((ref) {
  return AuthNotifier(ref.watch(apiServiceProvider));
});
