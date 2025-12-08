import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
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
    } catch (e) {
      state = state.copyWith(isLoading: false, error: 'Failed to load contacts');
    }
  }

  Future<bool> saveContacts() async {
    state = state.copyWith(isLoading: true);
    try {
      await _apiService.updateEmergencyContacts(
        state.contacts.map((c) => c.toJson()).toList(),
      );
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
      appBar: AppBar(
        title: const Text('Emergency Contacts'),
        actions: [
          if (contactsState.isLoading)
            const Padding(
              padding: EdgeInsets.all(16),
              child: SizedBox(
                width: 20,
                height: 20,
                child: CircularProgressIndicator(strokeWidth: 2),
              ),
            ),
        ],
      ),
      body: contactsState.contacts.isEmpty && !contactsState.isLoading
          ? _buildEmptyState(context, ref)
          : RefreshIndicator(
              onRefresh: () => ref.read(contactsProvider.notifier).loadContacts(),
              child: ListView.builder(
                padding: const EdgeInsets.all(16),
                itemCount: contactsState.contacts.length,
                itemBuilder: (context, index) {
                  final contact = contactsState.contacts[index];
                  return _buildContactCard(context, ref, contact);
                },
              ),
            ),
      floatingActionButton: FloatingActionButton.extended(
        onPressed: () => _showAddContactDialog(context, ref),
        icon: const Icon(Icons.add),
        label: const Text('Add Contact'),
        backgroundColor: AppColors.primary,
      ),
    );
  }

  Widget _buildEmptyState(BuildContext context, WidgetRef ref) {
    return Center(
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Icon(
            Icons.contacts_outlined,
            size: 80,
            color: AppColors.textHint,
          ),
          const SizedBox(height: 16),
          const Text(
            'No Emergency Contacts',
            style: TextStyle(
              fontSize: 20,
              fontWeight: FontWeight.w600,
            ),
          ),
          const SizedBox(height: 8),
          Text(
            'Add contacts who will be notified\nvia SMS and WhatsApp during an SOS',
            textAlign: TextAlign.center,
            style: TextStyle(color: AppColors.textSecondary),
          ),
          const SizedBox(height: 24),
          ElevatedButton.icon(
            onPressed: () => _showAddContactDialog(context, ref),
            icon: const Icon(Icons.add),
            label: const Text('Add Contact'),
          ),
        ],
      ),
    );
  }

  Widget _buildContactCard(BuildContext context, WidgetRef ref, EmergencyContact contact) {
    return Card(
      margin: const EdgeInsets.only(bottom: 12),
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Row(
          children: [
            CircleAvatar(
              radius: 28,
              backgroundColor: contact.isPrimary
                  ? AppColors.primary.withOpacity(0.1)
                  : AppColors.textHint.withOpacity(0.1),
              child: Text(
                contact.name.isNotEmpty ? contact.name[0].toUpperCase() : '?',
                style: TextStyle(
                  fontSize: 24,
                  fontWeight: FontWeight.bold,
                  color: contact.isPrimary ? AppColors.primary : AppColors.textSecondary,
                ),
              ),
            ),
            const SizedBox(width: 16),
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
                          ),
                          overflow: TextOverflow.ellipsis,
                        ),
                      ),
                      if (contact.isPrimary) ...[
                        const SizedBox(width: 8),
                        Container(
                          padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                          decoration: BoxDecoration(
                            color: AppColors.primary.withOpacity(0.1),
                            borderRadius: BorderRadius.circular(12),
                          ),
                          child: Text(
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
                    style: TextStyle(color: AppColors.textSecondary),
                  ),
                  Row(
                    children: [
                      Text(
                        contact.relationship,
                        style: TextStyle(fontSize: 12, color: AppColors.textHint),
                      ),
                      if (contact.whatsappEnabled) ...[
                        const SizedBox(width: 8),
                        Icon(Icons.chat, size: 14, color: Colors.green.shade600),
                        const SizedBox(width: 2),
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
                        Icon(Icons.star, size: 20),
                        SizedBox(width: 12),
                        Text('Set as Primary'),
                      ],
                    ),
                  ),
                const PopupMenuItem(
                  value: 'edit',
                  child: Row(
                    children: [
                      Icon(Icons.edit, size: 20),
                      SizedBox(width: 12),
                      Text('Edit'),
                    ],
                  ),
                ),
                const PopupMenuItem(
                  value: 'delete',
                  child: Row(
                    children: [
                      Icon(Icons.delete, size: 20, color: Colors.red),
                      SizedBox(width: 12),
                      Text('Delete', style: TextStyle(color: Colors.red)),
                    ],
                  ),
                ),
              ],
            ),
          ],
        ),
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
                const Text(
                  'Add Emergency Contact',
                  style: TextStyle(
                    fontSize: 20,
                    fontWeight: FontWeight.bold,
                  ),
                ),
                const SizedBox(height: 8),
                Text(
                  'This contact will receive alerts during SOS',
                  style: TextStyle(color: AppColors.textSecondary, fontSize: 14),
                ),
                const SizedBox(height: 24),
                TextField(
                  controller: nameController,
                  decoration: const InputDecoration(
                    labelText: 'Name',
                    prefixIcon: Icon(Icons.person_outline),
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
                    prefixIcon: Icon(Icons.people_outline),
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
                  onChanged: (value) {
                    setState(() => whatsappEnabled = value);
                  },
                  secondary: Icon(Icons.chat, color: Colors.green.shade600),
                ),
                const SizedBox(height: 24),
                SizedBox(
                  width: double.infinity,
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
                const Text(
                  'Edit Contact',
                  style: TextStyle(fontSize: 20, fontWeight: FontWeight.bold),
                ),
                const SizedBox(height: 24),
                TextField(
                  controller: nameController,
                  decoration: const InputDecoration(
                    labelText: 'Name',
                    prefixIcon: Icon(Icons.person_outline),
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
                    prefixIcon: Icon(Icons.people_outline),
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
                  onChanged: (value) {
                    setState(() => whatsappEnabled = value);
                  },
                  secondary: Icon(Icons.chat, color: Colors.green.shade600),
                ),
                const SizedBox(height: 24),
                SizedBox(
                  width: double.infinity,
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
            style: ElevatedButton.styleFrom(backgroundColor: Colors.red),
            child: const Text('Delete'),
          ),
        ],
      ),
    );
  }
}
