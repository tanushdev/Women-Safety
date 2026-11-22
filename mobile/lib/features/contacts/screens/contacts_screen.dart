import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:hive/hive.dart';
import '../../../core/services/api_service.dart';
import '../../../shared/theme/app_theme.dart';

// Emergency Contact Model
class EmergencyContact {
  final String id;
  final String name;
  final String phone;
  final String relationship;
  final bool isPrimary;
  final bool notifyOnSOS;
  final bool whatsappEnabled;

  EmergencyContact({
    required this.id,
    required this.name,
    required this.phone,
    required this.relationship,
    this.isPrimary = false,
    this.notifyOnSOS = true,
    this.whatsappEnabled = false,
  });

  factory EmergencyContact.fromJson(Map<String, dynamic> json) {
    return EmergencyContact(
      id: json['_id'] ?? json['id'] ?? DateTime.now().millisecondsSinceEpoch.toString(),
      name: json['name'] ?? '',
      phone: json['phone'] ?? '',
      relationship: json['relationship'] ?? '',
      isPrimary: json['isPrimary'] ?? false,
      notifyOnSOS: json['notifyOnSOS'] ?? true,
      whatsappEnabled: json['whatsappEnabled'] ?? false,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'name': name,
      'phone': phone,
      'relationship': relationship,
      'notifyOnSOS': notifyOnSOS,
      'whatsappEnabled': whatsappEnabled,
    };
  }

  EmergencyContact copyWith({
    String? id,
    String? name,
    String? phone,
    String? relationship,
    bool? isPrimary,
    bool? notifyOnSOS,
    bool? whatsappEnabled,
  }) {
    return EmergencyContact(
      id: id ?? this.id,
      name: name ?? this.name,
      phone: phone ?? this.phone,
      relationship: relationship ?? this.relationship,
      isPrimary: isPrimary ?? this.isPrimary,
      notifyOnSOS: notifyOnSOS ?? this.notifyOnSOS,
      whatsappEnabled: whatsappEnabled ?? this.whatsappEnabled,
    );
  }
}

// Contacts State
class ContactsState {
  final List<EmergencyContact> contacts;
  final bool isLoading;
  final String? error;

  ContactsState({
    this.contacts = const [],
    this.isLoading = false,
    this.error,
  });

  ContactsState copyWith({
    List<EmergencyContact>? contacts,
    bool? isLoading,
    String? error,
  }) {
    return ContactsState(
      contacts: contacts ?? this.contacts,
      isLoading: isLoading ?? this.isLoading,
      error: error,
    );
  }
}

// Contacts Provider
final contactsProvider = StateNotifierProvider<ContactsNotifier, ContactsState>((ref) {
  return ContactsNotifier(ref.watch(apiServiceProvider));
});

class ContactsNotifier extends StateNotifier<ContactsState> {
  final ApiService _apiService;

  ContactsNotifier(this._apiService) : super(ContactsState()) {
    loadContacts();
  }

  Future<void> loadContacts() async {
    state = state.copyWith(isLoading: true, error: null);
    try {
      final response = await _apiService.getEmergencyContacts();
      final List<dynamic> data = response.data is List ? response.data : response.data['contacts'] ?? [];
      final contacts = data.map((c) => EmergencyContact.fromJson(c)).toList();
      state = state.copyWith(contacts: contacts, isLoading: false);

      // Cache to Hive for offline access
      try {
        final box = await Hive.openBox('emergency_contacts');
        await box.put('cached_contacts', contacts.map((c) => c.toJson()).toList());
      } catch (_) {}
    } catch (e) {
      // Offline fallback: load from local cache
      try {
        final box = await Hive.openBox('emergency_contacts');
        final cached = box.get('cached_contacts');
        if (cached is List && cached.isNotEmpty) {
          final contacts = cached.map((c) => EmergencyContact.fromJson(Map<String, dynamic>.from(c))).toList();
          state = state.copyWith(contacts: contacts, isLoading: false);
          return;
        }
      } catch (_) {}
      state = state.copyWith(isLoading: false, error: 'Failed to load contacts');
    }
  }

  Future<bool> saveContacts() async {
    state = state.copyWith(isLoading: true);
    try {
      final contactsJson = state.contacts.map((c) => c.toJson()).toList();
      await _apiService.updateEmergencyContacts(contactsJson);

      // Cache locally
      try {
        final box = await Hive.openBox('emergency_contacts');
        await box.put('cached_contacts', contactsJson);
      } catch (_) {}

      state = state.copyWith(isLoading: false);
      return true;
    } catch (e) {
      state = state.copyWith(isLoading: false, error: 'Failed to save contacts');
      return false;
    }
  }

  void addContact(EmergencyContact contact) {
    state = state.copyWith(contacts: [...state.contacts, contact]);
    saveContacts();
  }

  void updateContact(EmergencyContact contact) {
    state = state.copyWith(
      contacts: state.contacts.map((c) => c.id == contact.id ? contact : c).toList(),
    );
    saveContacts();
  }

  void deleteContact(String id) {
    state = state.copyWith(
      contacts: state.contacts.where((c) => c.id != id).toList(),
    );
    saveContacts();
  }

  void setPrimary(String id) {
    state = state.copyWith(
      contacts: state.contacts.map((c) => c.copyWith(isPrimary: c.id == id)).toList(),
    );
    saveContacts();
  }
}

class ContactsScreen extends ConsumerWidget {
  const ContactsScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final contactsState = ref.watch(contactsProvider);

    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AppBar(
        title: const Text('Emergency Contacts'),
        actions: [
          if (contactsState.isLoading)
            const Padding(
              padding: EdgeInsets.all(16),
              child: SizedBox(
                width: 20,
                height: 20,
                child: CircularProgressIndicator(
                  strokeWidth: 2,
                  color: AppColors.primary,
                ),
              ),
            ),
        ],
      ),
      body: contactsState.contacts.isEmpty && !contactsState.isLoading
          ? _buildEmptyState(context, ref)
          : RefreshIndicator(
              color: AppColors.primary,
              onRefresh: () => ref.read(contactsProvider.notifier).loadContacts(),
              child: ListView.builder(
                padding: const EdgeInsets.all(20),
                itemCount: contactsState.contacts.length,
                itemBuilder: (context, index) {
                  final contact = contactsState.contacts[index];
                  return _buildContactCard(context, ref, contact);
                },
              ),
            ),
      floatingActionButton: FloatingActionButton.extended(
        onPressed: () => _showAddContactDialog(context, ref),
        icon: const Icon(Icons.add_rounded),
        label: const Text(
          'Add Contact',
          style: TextStyle(fontWeight: FontWeight.w600),
        ),
        backgroundColor: AppColors.primary,
        foregroundColor: Colors.white,
        elevation: 0,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(50),
        ),
      ),
    );
  }

  Widget _buildEmptyState(BuildContext context, WidgetRef ref) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(32),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Container(
              width: 80,
              height: 80,
              decoration: BoxDecoration(
                color: AppColors.primaryLight,
                borderRadius: BorderRadius.circular(20),
              ),
              child: const Icon(
                Icons.contacts_outlined,
                size: 40,
                color: AppColors.primary,
              ),
            ),
            const SizedBox(height: 24),
            const Text(
              'No Emergency Contacts',
              style: TextStyle(
                fontSize: 20,
                fontWeight: FontWeight.w600,
                color: AppColors.textPrimary,
              ),
            ),
            const SizedBox(height: 8),
            const Text(
              'Add contacts who will be notified\nvia SMS and WhatsApp during an SOS',
              textAlign: TextAlign.center,
              style: TextStyle(
                color: AppColors.textSecondary,
                fontSize: 14,
                height: 1.5,
              ),
            ),
            const SizedBox(height: 28),
            SizedBox(
              height: 50,
              child: ElevatedButton.icon(
                onPressed: () => _showAddContactDialog(context, ref),
                icon: const Icon(Icons.add_rounded),
                label: const Text('Add Contact'),
                style: ElevatedButton.styleFrom(
                  backgroundColor: AppColors.primary,
                  foregroundColor: Colors.white,
                  elevation: 0,
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(50),
                  ),
                  padding: const EdgeInsets.symmetric(horizontal: 28),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildContactCard(BuildContext context, WidgetRef ref, EmergencyContact contact) {
    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(20),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.06),
            blurRadius: 12,
            offset: const Offset(0, 4),
          ),
        ],
      ),
      child: Row(
        children: [
          Container(
            width: 52,
            height: 52,
            decoration: BoxDecoration(
              color: contact.isPrimary
                  ? AppColors.primaryLight
                  : const Color(0xFFF3F4F6),
              borderRadius: BorderRadius.circular(16),
            ),
            child: Center(
              child: Text(
                contact.name.isNotEmpty ? contact.name[0].toUpperCase() : '?',
                style: TextStyle(
                  fontSize: 22,
                  fontWeight: FontWeight.bold,
                  color: contact.isPrimary ? AppColors.primary : AppColors.textSecondary,
                ),
              ),
            ),
          ),
          const SizedBox(width: 14),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    Flexible(
                      child: Text(
                        contact.name,
                        style: const TextStyle(
                          fontSize: 16,
                          fontWeight: FontWeight.w600,
                          color: AppColors.textPrimary,
                        ),
                        overflow: TextOverflow.ellipsis,
                      ),
                    ),
                    if (contact.isPrimary) ...[
                      const SizedBox(width: 8),
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 3),
                        decoration: BoxDecoration(
                          color: AppColors.primaryLight,
                          borderRadius: BorderRadius.circular(50),
                        ),
                        child: const Text(
                          'Primary',
                          style: TextStyle(
                            fontSize: 10,
                            color: AppColors.primary,
                            fontWeight: FontWeight.w600,
                          ),
                        ),
                      ),
                    ],
                  ],
                ),
                const SizedBox(height: 4),
                Text(
                  contact.phone,
                  style: const TextStyle(
                    color: AppColors.textSecondary,
                    fontSize: 13,
                  ),
                ),
                const SizedBox(height: 2),
                Row(
                  children: [
                    Text(
                      contact.relationship,
                      style: const TextStyle(fontSize: 12, color: AppColors.textHint),
                    ),
                    if (contact.whatsappEnabled) ...[
                      const SizedBox(width: 8),
                      Icon(Icons.chat_rounded, size: 13, color: Colors.green.shade600),
                      const SizedBox(width: 3),
                      Text(
                        'WhatsApp',
                        style: TextStyle(fontSize: 10, color: Colors.green.shade600),
                      ),
                    ],
                  ],
                ),
              ],
            ),
          ),
          PopupMenuButton<String>(
            icon: const Icon(Icons.more_vert_rounded, color: AppColors.textSecondary),
            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
            onSelected: (value) {
              switch (value) {
                case 'primary':
                  ref.read(contactsProvider.notifier).setPrimary(contact.id);
                  break;
                case 'edit':
                  _showEditContactDialog(context, ref, contact);
                  break;
                case 'delete':
                  _showDeleteConfirmation(context, ref, contact);
                  break;
              }
            },
            itemBuilder: (context) => [
              if (!contact.isPrimary)
                const PopupMenuItem(
                  value: 'primary',
                  child: Row(
                    children: [
                      Icon(Icons.star_rounded, size: 20, color: AppColors.primary),
                      SizedBox(width: 12),
                      Text('Set as Primary'),
                    ],
                  ),
                ),
              const PopupMenuItem(
                value: 'edit',
                child: Row(
                  children: [
                    Icon(Icons.edit_rounded, size: 20),
                    SizedBox(width: 12),
                    Text('Edit'),
                  ],
                ),
              ),
              const PopupMenuItem(
                value: 'delete',
                child: Row(
                  children: [
                    Icon(Icons.delete_rounded, size: 20, color: Colors.red),
                    SizedBox(width: 12),
                    Text('Delete', style: TextStyle(color: Colors.red)),
                  ],
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }

  void _showAddContactDialog(BuildContext context, WidgetRef ref) {
    final nameController = TextEditingController();
    final phoneController = TextEditingController();
    String relationship = 'Family';
    bool whatsappEnabled = false;

    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.white,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
      ),
      builder: (context) => StatefulBuilder(
        builder: (context, setState) => Padding(
          padding: EdgeInsets.only(
            bottom: MediaQuery.of(context).viewInsets.bottom,
          ),
          child: Container(
            padding: const EdgeInsets.all(24),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                // Handle bar
                Center(
                  child: Container(
                    width: 40,
                    height: 4,
                    margin: const EdgeInsets.only(bottom: 20),
                    decoration: BoxDecoration(
                      color: AppColors.disabled,
                      borderRadius: BorderRadius.circular(2),
                    ),
                  ),
                ),
                const Text(
                  'Add Emergency Contact',
                  style: TextStyle(
                    fontSize: 20,
                    fontWeight: FontWeight.bold,
                    color: AppColors.textPrimary,
                  ),
                ),
                const SizedBox(height: 6),
                const Text(
                  'This contact will receive alerts during SOS',
                  style: TextStyle(color: AppColors.textSecondary, fontSize: 14),
                ),
                const SizedBox(height: 24),
                TextField(
                  controller: nameController,
                  decoration: const InputDecoration(
                    labelText: 'Name',
                    prefixIcon: Icon(Icons.person_outline_rounded),
                  ),
                ),
                const SizedBox(height: 16),
                TextField(
                  controller: phoneController,
                  keyboardType: TextInputType.phone,
                  inputFormatters: [
                    FilteringTextInputFormatter.digitsOnly,
                    LengthLimitingTextInputFormatter(10),
                  ],
                  decoration: const InputDecoration(
                    labelText: 'Phone Number',
                    prefixIcon: Icon(Icons.phone_outlined),
                    prefixText: '+91 ',
                  ),
                ),
                const SizedBox(height: 16),
                DropdownButtonFormField<String>(
                  value: relationship,
                  decoration: const InputDecoration(
                    labelText: 'Relationship',
                    prefixIcon: Icon(Icons.people_outline_rounded),
                  ),
                  items: ['Family', 'Friend', 'Colleague', 'Neighbor', 'Other']
                      .map((r) => DropdownMenuItem(value: r, child: Text(r)))
                      .toList(),
                  onChanged: (value) {
                    setState(() => relationship = value!);
                  },
                ),
                const SizedBox(height: 16),
                SwitchListTile(
                  title: const Text('Enable WhatsApp alerts'),
                  subtitle: const Text('Send location via WhatsApp'),
                  value: whatsappEnabled,
                  activeColor: AppColors.primary,
                  onChanged: (value) {
                    setState(() => whatsappEnabled = value);
                  },
                  secondary: Icon(Icons.chat_rounded, color: Colors.green.shade600),
                  contentPadding: EdgeInsets.zero,
                ),
                const SizedBox(height: 24),
                SizedBox(
                  width: double.infinity,
                  height: 52,
                  child: ElevatedButton(
                    onPressed: () {
                      if (nameController.text.isNotEmpty &&
                          phoneController.text.length == 10) {
                        ref.read(contactsProvider.notifier).addContact(
                          EmergencyContact(
                            id: DateTime.now().millisecondsSinceEpoch.toString(),
                            name: nameController.text,
                            phone: '+91${phoneController.text}',
                            relationship: relationship,
                            whatsappEnabled: whatsappEnabled,
                          ),
                        );
                        Navigator.pop(context);
                        ScaffoldMessenger.of(context).showSnackBar(
                          const SnackBar(content: Text('Contact added and synced')),
                        );
                      } else {
                        ScaffoldMessenger.of(context).showSnackBar(
                          const SnackBar(content: Text('Please fill all fields correctly')),
                        );
                      }
                    },
                    style: ElevatedButton.styleFrom(
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(16),
                      ),
                    ),
                    child: const Text('Add Contact'),
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }

  void _showEditContactDialog(BuildContext context, WidgetRef ref, EmergencyContact contact) {
    final nameController = TextEditingController(text: contact.name);
    final phoneController = TextEditingController(
      text: contact.phone.replaceAll('+91', '').replaceAll(' ', ''),
    );
    String relationship = contact.relationship.isNotEmpty ? contact.relationship : 'Family';
    bool whatsappEnabled = contact.whatsappEnabled;

    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.white,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
      ),
      builder: (context) => StatefulBuilder(
        builder: (context, setState) => Padding(
          padding: EdgeInsets.only(
            bottom: MediaQuery.of(context).viewInsets.bottom,
          ),
          child: Container(
            padding: const EdgeInsets.all(24),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                // Handle bar
                Center(
                  child: Container(
                    width: 40,
                    height: 4,
                    margin: const EdgeInsets.only(bottom: 20),
                    decoration: BoxDecoration(
                      color: AppColors.disabled,
                      borderRadius: BorderRadius.circular(2),
                    ),
                  ),
                ),
                const Text(
                  'Edit Contact',
                  style: TextStyle(
                    fontSize: 20,
                    fontWeight: FontWeight.bold,
                    color: AppColors.textPrimary,
                  ),
                ),
                const SizedBox(height: 24),
                TextField(
                  controller: nameController,
                  decoration: const InputDecoration(
                    labelText: 'Name',
                    prefixIcon: Icon(Icons.person_outline_rounded),
                  ),
                ),
                const SizedBox(height: 16),
                TextField(
                  controller: phoneController,
                  keyboardType: TextInputType.phone,
                  inputFormatters: [
                    FilteringTextInputFormatter.digitsOnly,
                    LengthLimitingTextInputFormatter(10),
                  ],
                  decoration: const InputDecoration(
                    labelText: 'Phone Number',
                    prefixIcon: Icon(Icons.phone_outlined),
                    prefixText: '+91 ',
                  ),
                ),
                const SizedBox(height: 16),
                DropdownButtonFormField<String>(
                  value: ['Family', 'Friend', 'Colleague', 'Neighbor', 'Other'].contains(relationship)
                      ? relationship
                      : 'Other',
                  decoration: const InputDecoration(
                    labelText: 'Relationship',
                    prefixIcon: Icon(Icons.people_outline_rounded),
                  ),
                  items: ['Family', 'Friend', 'Colleague', 'Neighbor', 'Other']
                      .map((r) => DropdownMenuItem(value: r, child: Text(r)))
                      .toList(),
                  onChanged: (value) {
                    setState(() => relationship = value!);
                  },
                ),
                const SizedBox(height: 16),
                SwitchListTile(
                  title: const Text('Enable WhatsApp alerts'),
                  subtitle: const Text('Send location via WhatsApp'),
                  value: whatsappEnabled,
                  activeColor: AppColors.primary,
                  onChanged: (value) {
                    setState(() => whatsappEnabled = value);
                  },
                  secondary: Icon(Icons.chat_rounded, color: Colors.green.shade600),
                  contentPadding: EdgeInsets.zero,
                ),
                const SizedBox(height: 24),
                SizedBox(
                  width: double.infinity,
                  height: 52,
                  child: ElevatedButton(
                    onPressed: () {
                      ref.read(contactsProvider.notifier).updateContact(
                        contact.copyWith(
                          name: nameController.text,
                          phone: '+91${phoneController.text}',
                          relationship: relationship,
                          whatsappEnabled: whatsappEnabled,
                        ),
                      );
                      Navigator.pop(context);
                      ScaffoldMessenger.of(context).showSnackBar(
                        const SnackBar(content: Text('Contact updated')),
                      );
                    },
                    style: ElevatedButton.styleFrom(
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(16),
                      ),
                    ),
                    child: const Text('Save Changes'),
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }

  void _showDeleteConfirmation(BuildContext context, WidgetRef ref, EmergencyContact contact) {
    showDialog(
      context: context,
      builder: (context) => AlertDialog(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
        title: const Text('Delete Contact'),
        content: Text('Are you sure you want to remove ${contact.name} from your emergency contacts?'),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context),
            child: const Text('Cancel'),
          ),
          ElevatedButton(
            onPressed: () {
              ref.read(contactsProvider.notifier).deleteContact(contact.id);
              Navigator.pop(context);
              ScaffoldMessenger.of(context).showSnackBar(
                const SnackBar(content: Text('Contact deleted')),
              );
            },
            style: ElevatedButton.styleFrom(
              backgroundColor: Colors.red,
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(12),
              ),
            ),
            child: const Text('Delete'),
          ),
        ],
      ),
    );
  }
}
