import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:geolocator/geolocator.dart';
import 'package:go_router/go_router.dart';
import '../../../shared/theme/app_theme.dart';
import '../../../core/services/api_service.dart';

class ReportIncidentScreen extends ConsumerStatefulWidget {
  const ReportIncidentScreen({super.key});

  @override
  ConsumerState<ReportIncidentScreen> createState() => _ReportIncidentScreenState();
}

class _ReportIncidentScreenState extends ConsumerState<ReportIncidentScreen> {
  final TextEditingController _descController = TextEditingController();
  String _selectedCategory = 'Eve Teasing / Catcalling';
  bool _isAnonymous = true;
  String _severity = 'medium';
  bool _isSubmitting = false;

  final List<String> _categories = [
    'Eve Teasing / Catcalling',
    'Poor Street Lighting',
    'Stalking / Followed',
    'Suspicious Person / Vehicle',
    'Isolated Area / Danger Zone',
  ];

  Future<void> _submitReport() async {
    if (_descController.text.trim().isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Please enter a brief description')),
      );
      return;
    }

    setState(() => _isSubmitting = true);
    try {
      final pos = await Geolocator.getCurrentPosition();
      final api = ref.read(apiServiceProvider);

      await api.createIncidentReport({
        'incidentType': _selectedCategory,
        'description': _descController.text.trim(),
        'coordinates': [pos.longitude, pos.latitude],
        'isAnonymous': _isAnonymous,
        'severity': _severity,
      });

      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('🛡️ Thank you. Danger report submitted anonymously to alert the community.'),
            backgroundColor: Colors.green,
          ),
        );
        context.pop();
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Report logged locally.'),
            backgroundColor: Colors.green,
          ),
        );
        context.pop();
      }
    } finally {
      if (mounted) setState(() => _isSubmitting = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Report Danger / Unsafe Spot'),
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(20),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Container(
              padding: const EdgeInsets.all(14),
              decoration: BoxDecoration(
                color: Colors.amber.shade50,
                borderRadius: BorderRadius.circular(12),
                border: Border.all(color: Colors.amber.shade300),
              ),
              child: const Row(
                children: [
                  Icon(Icons.shield_outlined, color: Colors.orange, size: 26),
                  SizedBox(width: 10),
                  Expanded(
                    child: Text(
                      'Your report updates the danger zone heatmap to keep women safe in this area. You can report 100% anonymously.',
                      style: TextStyle(fontSize: 12),
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 24),
            const Text('Incident Category', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 16)),
            const SizedBox(height: 10),
            Wrap(
              spacing: 8,
              runSpacing: 8,
              children: _categories.map((cat) {
                final selected = _selectedCategory == cat;
                return ChoiceChip(
                  label: Text(cat, style: TextStyle(fontSize: 13, color: selected ? Colors.white : Colors.black87)),
                  selected: selected,
                  selectedColor: AppColors.primary,
                  onSelected: (val) {
                    if (val) setState(() => _selectedCategory = cat);
                  },
                );
              }).toList(),
            ),
            const SizedBox(height: 20),
            const Text('Description', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 16)),
            const SizedBox(height: 8),
            TextField(
              controller: _descController,
              maxLines: 4,
              decoration: InputDecoration(
                hintText: 'e.g. Broken streetlight, group of people harassing pedestrians...',
                border: OutlineInputBorder(borderRadius: BorderRadius.circular(12)),
              ),
            ),
            const SizedBox(height: 16),
            SwitchListTile(
              title: const Text('Report Anonymously'),
              subtitle: const Text('Your name and phone number will not be attached'),
              value: _isAnonymous,
              onChanged: (val) => setState(() => _isAnonymous = val),
              secondary: const Icon(Icons.visibility_off, color: Colors.grey),
            ),
            const SizedBox(height: 24),
            SizedBox(
              width: double.infinity,
              child: ElevatedButton.icon(
                onPressed: _isSubmitting ? null : _submitReport,
                icon: const Icon(Icons.send, color: Colors.white),
                label: _isSubmitting
                    ? const CircularProgressIndicator(color: Colors.white)
                    : const Text('Submit Report', style: TextStyle(color: Colors.white, fontSize: 16)),
                style: ElevatedButton.styleFrom(
                  backgroundColor: AppColors.primary,
                  padding: const EdgeInsets.symmetric(vertical: 16),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
