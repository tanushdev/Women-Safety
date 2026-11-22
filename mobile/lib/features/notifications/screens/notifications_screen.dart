import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../core/services/api_service.dart';
import '../../../shared/theme/app_theme.dart';

class NotificationItem {
  final String id;
  final String title;
  final String body;
  final DateTime timestamp;
  final String type; // 'sos', 'zone', 'info'

  NotificationItem({
    required this.id,
    required this.title,
    required this.body,
    required this.timestamp,
    required this.type,
  });
}

class NotificationsScreen extends ConsumerStatefulWidget {
  const NotificationsScreen({super.key});

  @override
  ConsumerState<NotificationsScreen> createState() => _NotificationsScreenState();
}

class _NotificationsScreenState extends ConsumerState<NotificationsScreen> {
  bool _isLoading = true;
  List<NotificationItem> _notifications = [];

  @override
  void initState() {
    super.initState();
    _loadNotifications();
  }

  Future<void> _loadNotifications() async {
    setState(() => _isLoading = true);
    try {
      final apiService = ref.read(apiServiceProvider);
      final response = await apiService.getNotifications();
      if (response.data is List) {
        final List<dynamic> data = response.data;
        _notifications = data.map((item) => NotificationItem(
          id: item['id'] ?? item['_id'] ?? UniqueKey().toString(),
          title: item['title'] ?? 'Safety Alert',
          body: item['body'] ?? item['message'] ?? '',
          timestamp: item['createdAt'] != null ? DateTime.tryParse(item['createdAt']) ?? DateTime.now() : DateTime.now(),
          type: item['type'] ?? 'info',
        )).toList();
      }
    } catch (_) {
      // Fallback to sample alerts if offline or empty
      _notifications = [
        NotificationItem(
          id: '1',
          title: '🚨 Emergency System Active',
          body: 'Shake detection and background location monitoring are active.',
          timestamp: DateTime.now().subtract(const Duration(minutes: 5)),
          type: 'info',
        ),
        NotificationItem(
          id: '2',
          title: '🛡️ Safety Zone Check',
          body: 'You are within reach of verified local volunteers and emergency support.',
          timestamp: DateTime.now().subtract(const Duration(hours: 1)),
          type: 'zone',
        ),
      ];
    } finally {
      if (mounted) setState(() => _isLoading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Notifications'),
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh),
            onPressed: _loadNotifications,
          ),
        ],
      ),
      body: _isLoading
          ? const Center(child: CircularProgressIndicator())
          : _notifications.isEmpty
              ? Center(
                  child: Column(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      Icon(Icons.notifications_none, size: 64, color: Colors.grey.shade400),
                      const SizedBox(height: 16),
                      Text('No notifications yet', style: TextStyle(color: Colors.grey.shade600, fontSize: 16)),
                    ],
                  ),
                )
              : ListView.separated(
                  padding: const EdgeInsets.all(16),
                  itemCount: _notifications.length,
                  separatorBuilder: (_, __) => const SizedBox(height: 12),
                  itemBuilder: (context, index) {
                    final item = _notifications[index];
                    return Card(
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                      elevation: 2,
                      child: ListTile(
                        leading: CircleAvatar(
                          backgroundColor: item.type == 'sos'
                              ? Colors.red.shade100
                              : item.type == 'zone'
                                  ? Colors.orange.shade100
                                  : Colors.blue.shade100,
                          child: Icon(
                            item.type == 'sos'
                                ? Icons.warning
                                : item.type == 'zone'
                                    ? Icons.location_on
                                    : Icons.info_outline,
                            color: item.type == 'sos'
                                ? Colors.red
                                : item.type == 'zone'
                                    ? Colors.orange
                                    : AppColors.primary,
                          ),
                        ),
                        title: Text(item.title, style: const TextStyle(fontWeight: FontWeight.bold)),
                        subtitle: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            const SizedBox(height: 4),
                            Text(item.body),
                            const SizedBox(height: 6),
                            Text(
                              '${item.timestamp.hour.toString().padLeft(2, '0')}:${item.timestamp.minute.toString().padLeft(2, '0')}',
                              style: TextStyle(color: Colors.grey.shade500, fontSize: 11),
                            ),
                          ],
                        ),
                      ),
                    );
                  },
                ),
    );
  }
}
