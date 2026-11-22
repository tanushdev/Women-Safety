import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../services/auth_service.dart';
import '../../features/auth/screens/login_screen.dart';
import '../../features/home/screens/home_screen.dart';
import '../../features/sos/screens/sos_screen.dart';
import '../../features/map/screens/map_screen.dart';
import '../../features/profile/screens/profile_screen.dart';
import '../../features/contacts/screens/contacts_screen.dart';
import '../../features/volunteer/screens/volunteer_screen.dart';
import '../../features/notifications/screens/notifications_screen.dart';
import '../../features/deadmans_switch/screens/deadmans_switch_screen.dart';
import '../../features/journey/screens/journey_screen.dart';
import '../../features/fake_call/screens/fake_call_screen.dart';
import '../../features/stealth/screens/calc_screen.dart';
import '../../features/reports/screens/report_incident_screen.dart';
import '../../features/history/screens/incident_history_screen.dart';

final appRouterProvider = Provider<GoRouter>((ref) {
  final authState = ref.watch(authProvider);

  return GoRouter(
    initialLocation: authState.isAuthenticated ? '/home' : '/login',
    redirect: (context, state) {
      final isAuthenticated = authState.isAuthenticated;
      final isLoggingIn = state.matchedLocation == '/login';

      if (!isAuthenticated && !isLoggingIn) {
        return '/login';
      }

      if (isAuthenticated && isLoggingIn) {
        return '/home';
      }

      return null;
    },
    routes: [
      GoRoute(
        path: '/login',
        name: 'login',
        builder: (context, state) => const LoginScreen(),
      ),
      GoRoute(
        path: '/home',
        name: 'home',
        builder: (context, state) => const HomeScreen(),
      ),
      GoRoute(
        path: '/sos',
        name: 'sos',
        builder: (context, state) => const SosScreen(),
      ),
      GoRoute(
        path: '/map',
        name: 'map',
        builder: (context, state) => const MapScreen(),
      ),
      GoRoute(
        path: '/profile',
        name: 'profile',
        builder: (context, state) => const ProfileScreen(),
      ),
      GoRoute(
        path: '/contacts',
        name: 'contacts',
        builder: (context, state) => const ContactsScreen(),
      ),
      GoRoute(
        path: '/volunteer',
        name: 'volunteer',
        builder: (context, state) => const VolunteerScreen(),
      ),
      GoRoute(
        path: '/notifications',
        name: 'notifications',
        builder: (context, state) => const NotificationsScreen(),
      ),
      GoRoute(
        path: '/safety-timer',
        name: 'safety-timer',
        builder: (context, state) => const DeadMansSwitchScreen(),
      ),
      GoRoute(
        path: '/journey',
        name: 'journey',
        builder: (context, state) => const JourneyScreen(),
      ),
      GoRoute(
        path: '/fake-call',
        name: 'fake-call',
        builder: (context, state) => const FakeCallScreen(),
      ),
      GoRoute(
        path: '/stealth-calc',
        name: 'stealth-calc',
        builder: (context, state) => const CalcScreen(),
      ),
      GoRoute(
        path: '/report-incident',
        name: 'report-incident',
        builder: (context, state) => const ReportIncidentScreen(),
      ),
      GoRoute(
        path: '/history',
        name: 'history',
        builder: (context, state) => const IncidentHistoryScreen(),
      ),
    ],
  );
});

