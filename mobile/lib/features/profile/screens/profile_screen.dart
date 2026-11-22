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
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
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
            style: ElevatedButton.styleFrom(
              backgroundColor: Colors.red,
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(12),
              ),
            ),
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
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
        title: const Text('Logout'),
        content: const Text('Are you sure you want to logout?'),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context, false),
            child: const Text('Cancel'),
          ),
          ElevatedButton(
            onPressed: () => Navigator.pop(context, true),
            style: ElevatedButton.styleFrom(
              backgroundColor: AppColors.primary,
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(12),
              ),
            ),
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

  // Compute identity verification progress (0.0 – 1.0)
  double get _verificationProgress {
    int filled = 0;
    int total = 4;
    if (_nameController.text.isNotEmpty) filled++;
    if (_emailController.text.isNotEmpty) filled++;
    if (_ageController.text.isNotEmpty) filled++;
    if (_aadharController.text.isNotEmpty) filled++;
    return filled / total;
  }

  @override
  Widget build(BuildContext context) {
    final authState = ref.watch(authProvider);

    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AppBar(
        title: const Text(
          'Profile',
          style: TextStyle(fontWeight: FontWeight.bold, fontSize: 18),
        ),
        centerTitle: true,
        actions: [
          IconButton(
            icon: Stack(
              alignment: Alignment.center,
              children: [
                const Icon(
                  Icons.notifications_outlined,
                  color: AppColors.textPrimary,
                  size: 22,
                ),
                Positioned(
                  top: 9,
                  right: 9,
                  child: Container(
                    width: 7,
                    height: 7,
                    decoration: const BoxDecoration(
                      color: Color(0xFFFF2D78),
                      shape: BoxShape.circle,
                    ),
                  ),
                ),
              ],
            ),
            onPressed: () => context.push('/notifications'),
          ),
          const SizedBox(width: 8),
        ],
      ),
      body: _isLoading
          ? const Center(
              child: CircularProgressIndicator(color: AppColors.primary),
            )
          : SingleChildScrollView(
              padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 8),
              child: Form(
                key: _formKey,
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    // 💎 Avatar Section matching Reference Image
                    Center(
                      child: Column(
                        children: [
                          Stack(
                            clipBehavior: Clip.none,
                            children: [
                              // Avatar circle with soft pink gradient
                              Container(
                                width: 110,
                                height: 110,
                                decoration: BoxDecoration(
                                  shape: BoxShape.circle,
                                  gradient: const LinearGradient(
                                    begin: Alignment.topCenter,
                                    end: Alignment.bottomCenter,
                                    colors: [
                                      Color(0xFFFFD1DC),
                                      Color(0xFFFF94B8),
                                    ],
                                  ),
                                  border: Border.all(color: Colors.white, width: 3),
                                  boxShadow: [
                                    BoxShadow(
                                      color: const Color(0xFFFF2D78).withValues(alpha: 0.2),
                                      blurRadius: 20,
                                      offset: const Offset(0, 8),
                                    ),
                                  ],
                                ),
                                child: Center(
                                  child: Text(
                                    (_nameController.text.isNotEmpty
                                            ? _nameController.text[0]
                                            : 'U')
                                        .toUpperCase(),
                                    style: const TextStyle(
                                      fontSize: 44,
                                      fontWeight: FontWeight.w800,
                                      color: Colors.white,
                                    ),
                                  ),
                                ),
                              ),
                              // 💎 Hot Pink Verification Checkmark Badge at TOP-LEFT (Reference)
                              Positioned(
                                top: -2,
                                left: -2,
                                child: Container(
                                  width: 32,
                                  height: 32,
                                  decoration: BoxDecoration(
                                    color: const Color(0xFFFF2D78),
                                    shape: BoxShape.circle,
                                    border: Border.all(color: Colors.white, width: 2.5),
                                    boxShadow: [
                                      BoxShadow(
                                        color: const Color(0xFFFF2D78).withValues(alpha: 0.4),
                                        blurRadius: 8,
                                        offset: const Offset(0, 2),
                                      ),
                                    ],
                                  ),
                                  child: const Icon(
                                    Icons.check_rounded,
                                    size: 18,
                                    color: Colors.white,
                                  ),
                                ),
                              ),
                            ],
                          ),
                          const SizedBox(height: 14),
                          Row(
                            mainAxisAlignment: MainAxisAlignment.center,
                            children: [
                              Text(
                                _nameController.text.isNotEmpty
                                    ? _nameController.text
                                    : 'Protected User',
                                style: const TextStyle(
                                  fontSize: 22,
                                  fontWeight: FontWeight.w800,
                                  color: AppColors.textPrimary,
                                  letterSpacing: -0.3,
                                ),
                              ),
                              const SizedBox(width: 8),
                              GestureDetector(
                                onTap: () {
                                  setState(() {
                                    _isEditing = !_isEditing;
                                    if (!_isEditing) _loadProfile();
                                  });
                                },
                                child: Container(
                                  padding: const EdgeInsets.all(5),
                                  decoration: BoxDecoration(
                                    color: Colors.white,
                                    shape: BoxShape.circle,
                                    border: Border.all(color: Colors.grey.shade200),
                                    boxShadow: [
                                      BoxShadow(
                                        color: Colors.black.withValues(alpha: 0.04),
                                        blurRadius: 6,
                                      ),
                                    ],
                                  ),
                                  child: Icon(
                                    _isEditing ? Icons.check : Icons.edit_outlined,
                                    size: 15,
                                    color: const Color(0xFFFF2D78),
                                  ),
                                ),
                              ),
                            ],
                          ),
                          const SizedBox(height: 3),
                          Text(
                            authState.phone != null ? 'Verified · ${authState.phone}' : 'Protected Member',
                            style: const TextStyle(
                              fontSize: 13,
                              fontWeight: FontWeight.w500,
                              color: AppColors.textSecondary,
                            ),
                          ),
                        ],
                      ),
                    ),

                    const SizedBox(height: 24),

                    // 💎 Identity Verification Card matching Reference Image
                    Container(
                      padding: const EdgeInsets.all(20),
                      decoration: BoxDecoration(
                        color: Colors.white,
                        borderRadius: BorderRadius.circular(24),
                        border: Border.all(color: Colors.white, width: 1.5),
                        boxShadow: [
                          BoxShadow(
                            color: Colors.black.withValues(alpha: 0.04),
                            blurRadius: 18,
                            offset: const Offset(0, 6),
                          ),
                        ],
                      ),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Row(
                            mainAxisAlignment: MainAxisAlignment.spaceBetween,
                            children: [
                              const Text(
                                'Identity Verification',
                                style: TextStyle(
                                  fontSize: 15,
                                  fontWeight: FontWeight.w700,
                                  color: AppColors.textPrimary,
                                ),
                              ),
                              Text(
                                '${(_verificationProgress * 100).toInt()}%',
                                style: const TextStyle(
                                  fontSize: 16,
                                  fontWeight: FontWeight.w900,
                                  color: AppColors.textPrimary,
                                ),
                              ),
                            ],
                          ),
                          const SizedBox(height: 14),
                          // Dark pill progress bar matching reference
                          ClipRRect(
                            borderRadius: BorderRadius.circular(10),
                            child: Container(
                              height: 10,
                              color: const Color(0xFFF1F2F4),
                              child: LinearProgressIndicator(
                                value: _verificationProgress,
                                backgroundColor: const Color(0xFFF1F2F4),
                                valueColor: const AlwaysStoppedAnimation<Color>(
                                  Color(0xFF1E2124),
                                ),
                              ),
                            ),
                          ),
                        ],
                      ),
                    ),

                    const SizedBox(height: 16),

                    // 💎 Two Featured Quick Cards Side-by-Side (Reference Image)
                    Row(
                      children: [
                        Expanded(
                          child: Container(
                            padding: const EdgeInsets.all(16),
                            decoration: BoxDecoration(
                              color: Colors.white,
                              borderRadius: BorderRadius.circular(20),
                              border: Border.all(color: Colors.white, width: 1.5),
                              boxShadow: [
                                BoxShadow(
                                  color: Colors.black.withValues(alpha: 0.04),
                                  blurRadius: 14,
                                  offset: const Offset(0, 4),
                                ),
                              ],
                            ),
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Row(
                                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                                  children: [
                                    Container(
                                      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                                      decoration: BoxDecoration(
                                        color: const Color(0xFFF4F5F7),
                                        borderRadius: BorderRadius.circular(12),
                                      ),
                                      child: const Text(
                                        'New',
                                        style: TextStyle(
                                          fontSize: 11,
                                          fontWeight: FontWeight.w700,
                                          color: Color(0xFF1E2124),
                                        ),
                                      ),
                                    ),
                                    const Icon(
                                      Icons.arrow_outward_rounded,
                                      size: 16,
                                      color: Color(0xFF71717A),
                                    ),
                                  ],
                                ),
                                const SizedBox(height: 14),
                                const Text(
                                  'Live Guardian\nProtection',
                                  style: TextStyle(
                                    fontSize: 14,
                                    fontWeight: FontWeight.w800,
                                    color: AppColors.textPrimary,
                                    height: 1.2,
                                  ),
                                ),
                                const SizedBox(height: 4),
                                const Text(
                                  'Instant triage dispatch',
                                  style: TextStyle(
                                    fontSize: 11,
                                    color: AppColors.textSecondary,
                                  ),
                                ),
                              ],
                            ),
                          ),
                        ),
                        const SizedBox(width: 12),
                        Expanded(
                          child: Container(
                            padding: const EdgeInsets.all(16),
                            decoration: BoxDecoration(
                              color: Colors.white,
                              borderRadius: BorderRadius.circular(20),
                              border: Border.all(color: Colors.white, width: 1.5),
                              boxShadow: [
                                BoxShadow(
                                  color: Colors.black.withValues(alpha: 0.04),
                                  blurRadius: 14,
                                  offset: const Offset(0, 4),
                                ),
                              ],
                            ),
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Row(
                                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                                  children: [
                                    Container(
                                      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                                      decoration: BoxDecoration(
                                        color: const Color(0xFFFFF0F5),
                                        borderRadius: BorderRadius.circular(12),
                                      ),
                                      child: const Text(
                                        'Active',
                                        style: TextStyle(
                                          fontSize: 11,
                                          fontWeight: FontWeight.w700,
                                          color: Color(0xFFFF2D78),
                                        ),
                                      ),
                                    ),
                                    const Icon(
                                      Icons.security_rounded,
                                      size: 16,
                                      color: Color(0xFFFF2D78),
                                    ),
                                  ],
                                ),
                                const SizedBox(height: 14),
                                const Text(
                                  'Safe Havens\nRadar',
                                  style: TextStyle(
                                    fontSize: 14,
                                    fontWeight: FontWeight.w800,
                                    color: AppColors.textPrimary,
                                    height: 1.2,
                                  ),
                                ),
                                const SizedBox(height: 4),
                                const Text(
                                  'Verified local shelters',
                                  style: TextStyle(
                                    fontSize: 11,
                                    color: AppColors.textSecondary,
                                  ),
                                ),
                              ],
                            ),
                          ),
                        ),
                      ],
                    ),

                    const SizedBox(height: 24),

                    // Personal Information Section
                    _buildSectionHeader('Personal Information'),
                    const SizedBox(height: 12),

                    Container(
                      padding: const EdgeInsets.all(20),
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
                      child: Column(
                        children: [
                          // Full Name
                          _buildTextField(
                            controller: _nameController,
                            label: 'Full Name',
                            icon: Icons.person_outline_rounded,
                            enabled: _isEditing,
                            validator: (v) =>
                                v?.isEmpty == true ? 'Name is required' : null,
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

                    if (_isEditing) ...[
                      const SizedBox(height: 16),
                      SizedBox(
                        width: double.infinity,
                        height: 52,
                        child: ElevatedButton.icon(
                          onPressed: _saveProfile,
                          icon: const Icon(Icons.save_rounded),
                          label: const Text('Save Profile'),
                          style: ElevatedButton.styleFrom(
                            shape: RoundedRectangleBorder(
                              borderRadius: BorderRadius.circular(16),
                            ),
                          ),
                        ),
                      ),
                    ],

                    const SizedBox(height: 24),

                    // Emergency Contacts Section
                    _buildSectionHeader('Emergency Contacts'),
                    const SizedBox(height: 12),

                    _buildSettingsCard(
                      children: [
                        _buildSettingsTile(
                          icon: Icons.contacts_rounded,
                          title: 'Manage Emergency Contacts',
                          subtitle: _userProfile?['emergencyContacts']?.length != null &&
                                  _userProfile!['emergencyContacts'].length > 0
                              ? '${_userProfile!['emergencyContacts'].length} contacts'
                              : 'No contacts added',
                          onTap: () => context.push('/contacts'),
                        ),
                      ],
                    ),

                    const SizedBox(height: 24),

                    // Settings Section
                    _buildSectionHeader('Settings'),
                    const SizedBox(height: 12),

                    _buildSettingsCard(
                      children: [
                        _buildSettingsTile(
                          icon: Icons.notifications_outlined,
                          title: 'Notifications',
                          subtitle: 'Manage notification preferences',
                          onTap: () {},
                        ),
                        const Padding(
                          padding: EdgeInsets.symmetric(horizontal: 16),
                          child: Divider(height: 1),
                        ),
                        _buildSettingsTile(
                          icon: Icons.security_outlined,
                          title: 'Privacy & Security',
                          subtitle: 'Manage your data and security',
                          onTap: () {},
                        ),
                        const Padding(
                          padding: EdgeInsets.symmetric(horizontal: 16),
                          child: Divider(height: 1),
                        ),
                        _buildSettingsTile(
                          icon: Icons.help_outline_rounded,
                          title: 'Help & Support',
                          subtitle: 'Get help or contact support',
                          onTap: () {},
                        ),
                      ],
                    ),

                    const SizedBox(height: 24),

                    // Volunteer Section
                    _buildSectionHeader('Volunteer Program'),
                    const SizedBox(height: 12),

                    Builder(
                      builder: (context) {
                        final userState = ref.watch(userProvider);
                        final isVolunteer = userState.isVolunteer ||
                            _userProfile?['role'] == 'volunteer';

                        return Container(
                          decoration: BoxDecoration(
                            color: isVolunteer
                                ? const Color(0xFFF0FFF4)
                                : AppColors.primaryLight,
                            borderRadius: BorderRadius.circular(20),
                            boxShadow: [
                              BoxShadow(
                                color: Colors.black.withValues(alpha: 0.06),
                                blurRadius: 12,
                                offset: const Offset(0, 4),
                              ),
                            ],
                          ),
                          child: ListTile(
                            contentPadding: const EdgeInsets.symmetric(
                                horizontal: 16, vertical: 8),
                            leading: Container(
                              width: 44,
                              height: 44,
                              decoration: BoxDecoration(
                                color: isVolunteer
                                    ? Colors.green.shade100
                                    : AppColors.primary.withValues(alpha: 0.15),
                                borderRadius: BorderRadius.circular(14),
                              ),
                              child: Icon(
                                isVolunteer
                                    ? Icons.verified_rounded
                                    : Icons.volunteer_activism_rounded,
                                color: isVolunteer
                                    ? Colors.green.shade700
                                    : AppColors.primary,
                              ),
                            ),
                            title: Text(
                              isVolunteer
                                  ? 'Volunteer Dashboard'
                                  : 'Become a Volunteer',
                              style: const TextStyle(fontWeight: FontWeight.w600),
                            ),
                            subtitle: Text(
                              isVolunteer
                                  ? 'You are an approved volunteer ✓'
                                  : 'Help people in emergencies near you',
                              style: const TextStyle(fontSize: 13),
                            ),
                            trailing: const Icon(
                              Icons.chevron_right_rounded,
                              color: AppColors.textSecondary,
                            ),
                            onTap: () => context.push('/volunteer'),
                          ),
                        );
                      },
                    ),

                    const SizedBox(height: 24),

                    // Account Actions
                    _buildSectionHeader('Account'),
                    const SizedBox(height: 12),

                    _buildSettingsCard(
                      children: [
                        ListTile(
                          leading: Container(
                            width: 40,
                            height: 40,
                            decoration: BoxDecoration(
                              color: Colors.orange.shade50,
                              borderRadius: BorderRadius.circular(12),
                            ),
                            child: Icon(Icons.logout_rounded,
                                color: Colors.orange.shade700, size: 20),
                          ),
                          title: const Text('Logout'),
                          subtitle: const Text('Sign out from this device',
                              style: TextStyle(fontSize: 13)),
                          trailing: const Icon(Icons.chevron_right_rounded,
                              color: AppColors.textSecondary),
                          onTap: _logout,
                        ),
                        const Padding(
                          padding: EdgeInsets.symmetric(horizontal: 16),
                          child: Divider(height: 1),
                        ),
                        ListTile(
                          leading: Container(
                            width: 40,
                            height: 40,
                            decoration: BoxDecoration(
                              color: Colors.red.shade50,
                              borderRadius: BorderRadius.circular(12),
                            ),
                            child: Icon(Icons.delete_forever_rounded,
                                color: Colors.red.shade600, size: 20),
                          ),
                          title: const Text(
                            'Delete Account',
                            style: TextStyle(color: Colors.red),
                          ),
                          subtitle: const Text('Permanently delete all your data',
                              style: TextStyle(fontSize: 13)),
                          trailing: Icon(Icons.chevron_right_rounded,
                              color: Colors.red.shade300),
                          onTap: _deleteAccount,
                        ),
                      ],
                    ),

                    const SizedBox(height: 40),
                  ],
                ),
              ),
            ),
    );
  }

  Widget _buildSectionHeader(String title) {
    return Padding(
      padding: const EdgeInsets.only(left: 4),
      child: Text(
        title,
        style: const TextStyle(
          fontSize: 18,
          fontWeight: FontWeight.w800,
          color: AppColors.textPrimary,
          letterSpacing: -0.3,
        ),
      ),
    );
  }

  Widget _buildSettingsCard({required List<Widget> children}) {
    return Container(
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
      child: Column(children: children),
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
        prefixIcon: Icon(icon, color: AppColors.primary),
        filled: true,
        fillColor: enabled ? Colors.white : const Color(0xFFF9FAFB),
        border: OutlineInputBorder(
          borderRadius: BorderRadius.circular(16),
          borderSide: BorderSide(color: AppColors.disabled),
        ),
        enabledBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(16),
          borderSide: BorderSide(color: AppColors.disabled),
        ),
        focusedBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(16),
          borderSide: const BorderSide(color: AppColors.primary, width: 2),
        ),
        disabledBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(16),
          borderSide: BorderSide(color: AppColors.disabled.withValues(alpha: 0.5)),
        ),
      ),
    );
  }

  Widget _buildInfoField({
    required String label,
    required String value,
    required IconData icon,
  }) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 16),
      decoration: BoxDecoration(
        color: const Color(0xFFF9FAFB),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: AppColors.disabled.withValues(alpha: 0.5)),
      ),
      child: Row(
        children: [
          Icon(icon, color: AppColors.primary, size: 22),
          const SizedBox(width: 14),
          Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                label,
                style: const TextStyle(
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
                  color: AppColors.textPrimary,
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
      leading: Container(
        width: 40,
        height: 40,
        decoration: BoxDecoration(
          color: AppColors.primaryLight,
          borderRadius: BorderRadius.circular(12),
        ),
        child: Icon(icon, color: AppColors.primary, size: 20),
      ),
      title: Text(title, style: const TextStyle(fontWeight: FontWeight.w500)),
      subtitle:
          Text(subtitle, style: const TextStyle(fontSize: 13)),
      trailing: const Icon(Icons.chevron_right_rounded,
          color: AppColors.textSecondary),
      onTap: onTap,
    );
  }
}
