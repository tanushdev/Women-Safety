import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../../core/services/auth_service.dart';
import '../../../core/services/api_service.dart';
import '../../../shared/theme/app_theme.dart';
import '../../../shared/providers/user_provider.dart';

class ProfileScreen extends ConsumerStatefulWidget {
  const ProfileScreen({super.key});

  @override
  ConsumerState<ProfileScreen> createState() => _ProfileScreenState();
}

class _ProfileScreenState extends ConsumerState<ProfileScreen> {
  final _formKey = GlobalKey<FormState>();
  final _nameController = TextEditingController();
  final _emailController = TextEditingController();
  final _ageController = TextEditingController();
  final _aadharController = TextEditingController();
  
  bool _isEditing = false;
  bool _isLoading = false;
  Map<String, dynamic>? _userProfile;

  @override
  void initState() {
    super.initState();
    _loadProfile();
  }

  @override
  void dispose() {
    _nameController.dispose();
    _emailController.dispose();
    _ageController.dispose();
    _aadharController.dispose();
    super.dispose();
  }

  Future<void> _loadProfile() async {
    setState(() => _isLoading = true);
    try {
      final response = await ref.read(apiServiceProvider).getProfile();
      final data = response.data;
      setState(() {
        _userProfile = data;
        _nameController.text = data['name'] ?? '';
        _emailController.text = data['email'] ?? '';
        _ageController.text = data['age']?.toString() ?? '';
        _aadharController.text = data['aadharNumber'] ?? '';
      });
    } catch (e) {
      // Use auth state as fallback
      final authState = ref.read(authProvider);
      _nameController.text = authState.userName ?? '';
    } finally {
      setState(() => _isLoading = false);
    }
  }

  Future<void> _saveProfile() async {
    if (!_formKey.currentState!.validate()) return;

    setState(() => _isLoading = true);
    try {
      final data = {
        'name': _nameController.text.trim(),
        'email': _emailController.text.trim().isNotEmpty 
            ? _emailController.text.trim() 
            : null,
        'age': _ageController.text.isNotEmpty 
            ? int.tryParse(_ageController.text) 
            : null,
        'aadharNumber': _aadharController.text.trim().isNotEmpty 
            ? _aadharController.text.trim() 
            : null,
      };
      
      await ref.read(apiServiceProvider).updateProfile(data);
      
      if (mounted) {
        setState(() => _isEditing = false);
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Profile updated successfully'),
            backgroundColor: Colors.green,
          ),
        );
        _loadProfile();
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Failed to update profile: $e'),
            backgroundColor: Colors.red,
          ),
        );
      }
    } finally {
      if (mounted) setState(() => _isLoading = false);
    }
  }

  Future<void> _deleteAccount() async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Delete Account'),
        content: const Text(
          'Are you sure you want to delete your account?\n\n'
          'This will permanently delete all your data including:\n'
          '• Profile information\n'
          '• Emergency contacts\n'
          '• SOS history\n\n'
          'This action cannot be undone.',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context, false),
            child: const Text('Cancel'),
          ),
          ElevatedButton(
            onPressed: () => Navigator.pop(context, true),
            style: ElevatedButton.styleFrom(backgroundColor: Colors.red),
            child: const Text('Delete Forever'),
          ),
        ],
      ),
    );

    if (confirmed == true && mounted) {
      setState(() => _isLoading = true);
      try {
        // Call delete API
        await ref.read(apiServiceProvider).deleteAccount();
        await ref.read(authProvider.notifier).logout();
        if (mounted) context.go('/login');
      } catch (e) {
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(content: Text('Failed to delete account: $e')),
          );
        }
      } finally {
        if (mounted) setState(() => _isLoading = false);
      }
    }
  }

  Future<void> _logout() async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Logout'),
        content: const Text('Are you sure you want to logout?'),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context, false),
            child: const Text('Cancel'),
          ),
          ElevatedButton(
            onPressed: () => Navigator.pop(context, true),
            style: ElevatedButton.styleFrom(backgroundColor: Colors.red),
            child: const Text('Logout'),
          ),
        ],
      ),
    );

    if (confirmed == true && mounted) {
      ref.read(userProvider.notifier).clearUser(); // Clear user state
      await ref.read(authProvider.notifier).logout();
      if (mounted) context.go('/login');
    }
  }

  @override
  Widget build(BuildContext context) {
    final authState = ref.watch(authProvider);

    return Scaffold(
      appBar: AppBar(
        title: const Text('My Profile'),
        actions: [
          if (!_isLoading)
            IconButton(
              icon: Icon(_isEditing ? Icons.close : Icons.edit),
              onPressed: () {
                setState(() {
                  _isEditing = !_isEditing;
                  if (!_isEditing) _loadProfile(); // Reset on cancel
                });
              },
            ),
        ],
      ),
      body: _isLoading
          ? const Center(child: CircularProgressIndicator())
          : SingleChildScrollView(
              padding: const EdgeInsets.all(16),
              child: Form(
                key: _formKey,
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    // Profile Avatar
                    Center(
                      child: Stack(
                        children: [
                          CircleAvatar(
                            radius: 50,
                            backgroundColor: AppColors.primary.withOpacity(0.1),
                            child: Text(
                              (_nameController.text.isNotEmpty 
                                  ? _nameController.text[0] 
                                  : 'U').toUpperCase(),
                              style: TextStyle(
                                fontSize: 40,
                                fontWeight: FontWeight.bold,
                                color: AppColors.primary,
                              ),
                            ),
                          ),
                          if (_isEditing)
                            Positioned(
                              right: 0,
                              bottom: 0,
                              child: Container(
                                padding: const EdgeInsets.all(6),
                                decoration: BoxDecoration(
                                  color: AppColors.primary,
                                  shape: BoxShape.circle,
                                ),
                                child: const Icon(
                                  Icons.camera_alt,
                                  size: 16,
                                  color: Colors.white,
                                ),
                              ),
                            ),
                        ],
                      ),
                    ),

                    const SizedBox(height: 32),

                    // Personal Information Section
                    _buildSectionHeader('Personal Information'),
                    const SizedBox(height: 12),
                    
                    Card(
                      child: Padding(
                        padding: const EdgeInsets.all(16),
                        child: Column(
                          children: [
                            // Full Name
                            _buildTextField(
                              controller: _nameController,
                              label: 'Full Name',
                              icon: Icons.person_outline,
                              enabled: _isEditing,
                              validator: (v) => v?.isEmpty == true 
                                  ? 'Name is required' 
                                  : null,
                            ),
                            const SizedBox(height: 16),

                            // Phone (read-only)
                            _buildInfoField(
                              label: 'Phone Number',
                              value: authState.phone ?? 'Not set',
                              icon: Icons.phone_outlined,
                            ),
                            const SizedBox(height: 16),

                            // Email
                            _buildTextField(
                              controller: _emailController,
                              label: 'Email Address',
                              icon: Icons.email_outlined,
                              enabled: _isEditing,
                              keyboardType: TextInputType.emailAddress,
                            ),
                            const SizedBox(height: 16),

                            // Age
                            _buildTextField(
                              controller: _ageController,
                              label: 'Age',
                              icon: Icons.cake_outlined,
                              enabled: _isEditing,
                              keyboardType: TextInputType.number,
                              inputFormatters: [
                                FilteringTextInputFormatter.digitsOnly,
                                LengthLimitingTextInputFormatter(2),
                              ],
                            ),
                            const SizedBox(height: 16),

                            // Aadhar Number
                            _buildTextField(
                              controller: _aadharController,
                              label: 'Aadhar Number',
                              icon: Icons.badge_outlined,
                              enabled: _isEditing,
                              keyboardType: TextInputType.number,
                              inputFormatters: [
                                FilteringTextInputFormatter.digitsOnly,
                                LengthLimitingTextInputFormatter(12),
                              ],
                              validator: (v) {
                                if (v != null && v.isNotEmpty && v.length != 12) {
                                  return 'Aadhar must be 12 digits';
                                }
                                return null;
                              },
                            ),
                          ],
                        ),
                      ),
                    ),

                    if (_isEditing) ...[
                      const SizedBox(height: 16),
                      SizedBox(
                        width: double.infinity,
                        child: ElevatedButton.icon(
                          onPressed: _saveProfile,
                          icon: const Icon(Icons.save),
                          label: const Text('Save Profile'),
                          style: ElevatedButton.styleFrom(
                            padding: const EdgeInsets.symmetric(vertical: 16),
                          ),
                        ),
                      ),
                    ],

                    const SizedBox(height: 24),

                    // Emergency Contacts Section
                    _buildSectionHeader('Emergency Contacts'),
                    const SizedBox(height: 12),
                    
                    Card(
                      child: ListTile(
                        leading: Icon(Icons.contacts, color: AppColors.primary),
                        title: const Text('Manage Emergency Contacts'),
                        subtitle: Text(
                          _userProfile?['emergencyContacts']?.length?.toString() ?? '0'
                        ) == '0' 
                            ? const Text('No contacts added')
                            : Text('${_userProfile?['emergencyContacts']?.length ?? 0} contacts'),
                        trailing: const Icon(Icons.chevron_right),
                        onTap: () => context.push('/contacts'),
                      ),
                    ),

                    const SizedBox(height: 24),

                    // Settings Section
                    _buildSectionHeader('Settings'),
                    const SizedBox(height: 12),
                    
                    Card(
                      child: Column(
                        children: [
                          _buildSettingsTile(
                            icon: Icons.notifications_outlined,
                            title: 'Notifications',
                            subtitle: 'Manage notification preferences',
                            onTap: () {},
                          ),
                          const Divider(height: 1),
                          _buildSettingsTile(
                            icon: Icons.security_outlined,
                            title: 'Privacy & Security',
                            subtitle: 'Manage your data and security',
                            onTap: () {},
                          ),
                          const Divider(height: 1),
                          _buildSettingsTile(
                            icon: Icons.help_outline,
                            title: 'Help & Support',
                            subtitle: 'Get help or contact support',
                            onTap: () {},
                          ),
                        ],
                      ),
                    ),

                    const SizedBox(height: 24),

                    // Volunteer Section
                    _buildSectionHeader('Volunteer Program'),
                    const SizedBox(height: 12),
                    
                    Builder(
                      builder: (context) {
                        final userState = ref.watch(userProvider);
                        final isVolunteer = userState.isVolunteer || _userProfile?['role'] == 'volunteer';
                        
                        return Card(
                          color: isVolunteer ? Colors.green.shade50 : Colors.purple.shade50,
                          child: ListTile(
                            leading: Container(
                              padding: const EdgeInsets.all(8),
                              decoration: BoxDecoration(
                                color: isVolunteer ? Colors.green.shade100 : Colors.purple.shade100,
                                borderRadius: BorderRadius.circular(8),
                              ),
                              child: Icon(
                                isVolunteer ? Icons.verified : Icons.volunteer_activism, 
                                color: isVolunteer ? Colors.green.shade700 : Colors.purple.shade700,
                              ),
                            ),
                            title: Text(
                              isVolunteer ? 'Volunteer Dashboard' : 'Become a Volunteer',
                              style: const TextStyle(fontWeight: FontWeight.bold),
                            ),
                            subtitle: Text(
                              isVolunteer 
                                ? 'You are an approved volunteer ✓' 
                                : 'Help people in emergencies near you',
                            ),
                            trailing: const Icon(Icons.chevron_right),
                            onTap: () => context.push('/volunteer'),
                          ),
                        );
                      },
                    ),

                    const SizedBox(height: 24),

                    // Danger Zone
                    _buildSectionHeader('Danger Zone', isRed: true),
                    const SizedBox(height: 12),
                    
                    Card(
                      color: Colors.red.shade50,
                      child: Column(
                        children: [
                          ListTile(
                            leading: const Icon(Icons.logout, color: Colors.orange),
                            title: const Text('Logout'),
                            subtitle: const Text('Sign out from this device'),
                            trailing: const Icon(Icons.chevron_right),
                            onTap: _logout,
                          ),
                          const Divider(height: 1),
                          ListTile(
                            leading: const Icon(Icons.delete_forever, color: Colors.red),
                            title: const Text(
                              'Delete Account',
                              style: TextStyle(color: Colors.red),
                            ),
                            subtitle: const Text('Permanently delete all your data'),
                            trailing: const Icon(Icons.chevron_right, color: Colors.red),
                            onTap: _deleteAccount,
                          ),
                        ],
                      ),
                    ),

                    const SizedBox(height: 40),
                  ],
                ),
              ),
            ),
    );
  }

  Widget _buildSectionHeader(String title, {bool isRed = false}) {
    return Text(
      title,
      style: TextStyle(
        fontSize: 14,
        fontWeight: FontWeight.bold,
        color: isRed ? Colors.red : AppColors.textSecondary,
        letterSpacing: 0.5,
      ),
    );
  }

  Widget _buildTextField({
    required TextEditingController controller,
    required String label,
    required IconData icon,
    bool enabled = true,
    TextInputType? keyboardType,
    List<TextInputFormatter>? inputFormatters,
    String? Function(String?)? validator,
  }) {
    return TextFormField(
      controller: controller,
      enabled: enabled,
      keyboardType: keyboardType,
      inputFormatters: inputFormatters,
      validator: validator,
      decoration: InputDecoration(
        labelText: label,
        prefixIcon: Icon(icon),
        filled: !enabled,
        fillColor: enabled ? null : Colors.grey.shade100,
      ),
    );
  }

  Widget _buildInfoField({
    required String label,
    required String value,
    required IconData icon,
  }) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 16),
      decoration: BoxDecoration(
        color: Colors.grey.shade100,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: Colors.grey.shade300),
      ),
      child: Row(
        children: [
          Icon(icon, color: AppColors.textSecondary),
          const SizedBox(width: 12),
          Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                label,
                style: TextStyle(
                  fontSize: 12,
                  color: AppColors.textHint,
                ),
              ),
              const SizedBox(height: 2),
              Text(
                value,
                style: const TextStyle(
                  fontSize: 16,
                  fontWeight: FontWeight.w500,
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildSettingsTile({
    required IconData icon,
    required String title,
    required String subtitle,
    required VoidCallback onTap,
  }) {
    return ListTile(
      leading: Icon(icon, color: AppColors.primary),
      title: Text(title),
      subtitle: Text(subtitle),
      trailing: const Icon(Icons.chevron_right),
      onTap: onTap,
    );
  }
}
