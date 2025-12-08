import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../core/services/api_service.dart';
import 'package:flutter/foundation.dart';


// User State Model
class UserState {
  final String? id;
  final String? name;
  final String? phone;
  final String? role; // 'user', 'volunteer', 'admin'
  final bool isLoading;

  const UserState({
    this.id,
    this.name,
    this.phone,
    this.role,
    this.isLoading = false,
  });

  UserState copyWith({
    String? id,
    String? name,
    String? phone,
    String? role,
    bool? isLoading,
  }) {
    return UserState(
      id: id ?? this.id,
      name: name ?? this.name,
      phone: phone ?? this.phone,
      role: role ?? this.role,
      isLoading: isLoading ?? this.isLoading,
    );
  }

  bool get isVolunteer => role == 'volunteer';
}

final userProvider = StateNotifierProvider<UserNotifier, UserState>((ref) {
  return UserNotifier(ref.read(apiServiceProvider));
});

class UserNotifier extends StateNotifier<UserState> {
  final ApiService _apiService;

  UserNotifier(this._apiService) : super(const UserState());

  Future<void> fetchProfile() async {
    state = state.copyWith(isLoading: true);
    try {
      final response = await _apiService.getProfile();
      debugPrint('Profile API Response status: ${response.statusCode}');
      debugPrint('Profile API Response data type: ${response.data.runtimeType}');
      debugPrint('Profile API Response data: ${response.data}');
      
      if (response.statusCode == 200 && response.data != null) {
        dynamic data = response.data;
        
        // Handle if data is wrapped in a 'data' field
        if (data is Map && data.containsKey('data')) {
          data = data['data'];
        }
        
        final role = data['role']?.toString();
        debugPrint('***** EXTRACTED ROLE: "$role" *****');
        
        state = UserState(
          id: data['_id']?.toString(),
          name: data['name']?.toString(),
          phone: data['phone']?.toString(),
          role: role,
          isLoading: false,
        );
        debugPrint('***** STATE UPDATED - Current role: "${state.role}" *****');
      } else {
        debugPrint('Fetch profile failed: ${response.statusCode}');
        state = state.copyWith(isLoading: false);
      }
    } catch (e, stackTrace) {
      debugPrint('Fetch profile error: $e');
      debugPrint('Stack trace: $stackTrace');
      state = state.copyWith(isLoading: false);
    }
  }

  void stopLoading() {
    state = state.copyWith(isLoading: false);
  }

  void setUser(String id, String name, String phone, String role) {
    state = UserState(
      id: id,
      name: name,
      phone: phone,
      role: role,
    );
  }

  void clearUser() {
    state = const UserState();
  }
}
