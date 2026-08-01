import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../../../global_ui/features/auth/domain/entities/staff_user.dart';
import '../../../../../global_ui/features/auth/presentation/providers/auth_controller.dart';
import '../../../../app/theme/saapt_theme.dart';

class SaaptProfileScreen extends ConsumerWidget {
  const SaaptProfileScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final auth = ref.watch(authControllerProvider);
    final user = auth.value?.user;
    final initial = user?.displayName.trim().isNotEmpty == true
        ? user!.displayName.trim()[0].toUpperCase()
        : 'T';
    return Scaffold(
      appBar: AppBar(
        title: const Text('Profile'),
        backgroundColor: Colors.white,
      ),
      body: ListView(
        padding: const EdgeInsets.all(20),
        children: [
          Container(
            padding: const EdgeInsets.all(24),
            decoration: BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.circular(8),
              border: Border.all(color: const Color(0xFFDDE5F2)),
            ),
            child: Column(
              children: [
                CircleAvatar(
                  radius: 38,
                  backgroundColor: const Color(0xFFE8EFFF),
                  child: Text(
                    initial,
                    style: const TextStyle(
                      color: SaaptTheme.primary,
                      fontSize: 28,
                      fontWeight: FontWeight.w800,
                    ),
                  ),
                ),
                const SizedBox(height: 14),
                Text(
                  user?.displayName ?? 'Teacher',
                  style: const TextStyle(
                    fontSize: 22,
                    fontWeight: FontWeight.w800,
                  ),
                ),
                const SizedBox(height: 4),
                Text(
                  user?.role ?? 'Staff',
                  style: const TextStyle(
                    color: SaaptTheme.primary,
                    fontWeight: FontWeight.w700,
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 16),
          _ProfileRow(
            icon: Icons.mail_outline,
            label: 'Email',
            value: user?.email ?? '-',
          ),
          _ProfileRow(
            icon: Icons.school_outlined,
            label: 'School',
            value: user?.schoolName ?? user?.schoolId ?? '-',
          ),
          if (user?.schoolProfile != null) ...[
            const SizedBox(height: 12),
            OutlinedButton.icon(
              style: OutlinedButton.styleFrom(
                minimumSize: const Size.fromHeight(52),
                foregroundColor: SaaptTheme.primary,
              ),
              onPressed: () =>
                  _showContactInformation(context, user!.schoolProfile!),
              icon: const Icon(Icons.contact_phone_outlined),
              label: const Text('Contact Information'),
            ),
          ],
          const SizedBox(height: 12),
          OutlinedButton.icon(
            style: OutlinedButton.styleFrom(
              minimumSize: const Size.fromHeight(52),
              foregroundColor: SaaptTheme.primary,
            ),
            onPressed: () => context.push('/notifications'),
            icon: const Icon(Icons.notifications_active_outlined),
            label: const Text('Notifications'),
          ),
          const SizedBox(height: 22),
          OutlinedButton.icon(
            style: OutlinedButton.styleFrom(
              minimumSize: const Size.fromHeight(52),
              foregroundColor: Theme.of(context).colorScheme.error,
            ),
            onPressed: auth.isLoading
                ? null
                : () => ref.read(authControllerProvider.notifier).logout(),
            icon: const Icon(Icons.logout),
            label: const Text('Sign Out'),
          ),
        ],
      ),
    );
  }
}

class _ProfileRow extends StatelessWidget {
  const _ProfileRow({
    required this.icon,
    required this.label,
    required this.value,
  });
  final IconData icon;
  final String label;
  final String value;

  @override
  Widget build(BuildContext context) => Container(
    margin: const EdgeInsets.only(bottom: 10),
    padding: const EdgeInsets.all(16),
    decoration: BoxDecoration(
      color: Colors.white,
      borderRadius: BorderRadius.circular(8),
      border: Border.all(color: const Color(0xFFDDE5F2)),
    ),
    child: Row(
      children: [
        Icon(icon, color: SaaptTheme.primary),
        const SizedBox(width: 14),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                label,
                style: const TextStyle(
                  color: Color(0xFF8A9AB8),
                  fontSize: 12,
                  fontWeight: FontWeight.w700,
                ),
              ),
              const SizedBox(height: 2),
              Text(value, style: const TextStyle(fontWeight: FontWeight.w600)),
            ],
          ),
        ),
      ],
    ),
  );
}

void _showContactInformation(
  BuildContext context,
  SchoolProfileDetails school,
) {
  showModalBottomSheet<void>(
    context: context,
    isScrollControlled: true,
    backgroundColor: Colors.white,
    shape: const RoundedRectangleBorder(
      borderRadius: BorderRadius.vertical(top: Radius.circular(18)),
    ),
    builder: (context) => DraggableScrollableSheet(
      expand: false,
      initialChildSize: 0.72,
      minChildSize: 0.4,
      maxChildSize: 0.92,
      builder: (context, controller) => ListView(
        controller: controller,
        padding: const EdgeInsets.fromLTRB(20, 18, 20, 28),
        children: [
          Center(
            child: Container(
              width: 42,
              height: 4,
              decoration: BoxDecoration(
                color: const Color(0xFFDDE5F2),
                borderRadius: BorderRadius.circular(99),
              ),
            ),
          ),
          const SizedBox(height: 18),
          Text(
            school.name,
            style: const TextStyle(
              color: SaaptTheme.navy,
              fontSize: 20,
              fontWeight: FontWeight.w900,
            ),
          ),
          const SizedBox(height: 4),
          Text(
            'Contact Information',
            style: TextStyle(
              color: SaaptTheme.navy.withValues(alpha: 0.62),
              fontWeight: FontWeight.w700,
            ),
          ),
          const SizedBox(height: 18),
          _ContactInfoRow(label: 'School Code', value: school.code),
          _ContactInfoRow(label: 'Email', value: school.email ?? '-'),
          _ContactInfoRow(
            label: 'Mobile Number',
            value: school.mobileNumber ?? '-',
          ),
          _ContactInfoRow(label: 'Address', value: school.address ?? '-'),
          if (school.contacts.isNotEmpty) ...[
            const SizedBox(height: 12),
            const Text(
              'Important Contacts',
              style: TextStyle(
                color: SaaptTheme.navy,
                fontSize: 16,
                fontWeight: FontWeight.w900,
              ),
            ),
            const SizedBox(height: 10),
            ...school.contacts.map((contact) => _ContactInfoBlock(contact)),
          ],
        ],
      ),
    ),
  );
}

class _ContactInfoRow extends StatelessWidget {
  const _ContactInfoRow({required this.label, required this.value});

  final String label;
  final String value;

  @override
  Widget build(BuildContext context) => Container(
    margin: const EdgeInsets.only(bottom: 10),
    padding: const EdgeInsets.all(14),
    decoration: BoxDecoration(
      color: const Color(0xFFF7FAFF),
      borderRadius: BorderRadius.circular(8),
      border: Border.all(color: const Color(0xFFDDE5F2)),
    ),
    child: Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          label,
          style: const TextStyle(
            color: Color(0xFF8A9AB8),
            fontSize: 12,
            fontWeight: FontWeight.w700,
          ),
        ),
        const SizedBox(height: 3),
        Text(
          value.isNotEmpty ? value : '-',
          style: const TextStyle(fontWeight: FontWeight.w700),
        ),
      ],
    ),
  );
}

class _ContactInfoBlock extends StatelessWidget {
  const _ContactInfoBlock(this.contact);

  final SchoolContactDetail contact;

  @override
  Widget build(BuildContext context) => Container(
    margin: const EdgeInsets.only(bottom: 10),
    padding: const EdgeInsets.all(14),
    decoration: BoxDecoration(
      color: const Color(0xFFEAF1FF),
      borderRadius: BorderRadius.circular(8),
      border: Border.all(color: const Color(0xFFDDE5F2)),
    ),
    child: Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          contact.department,
          style: const TextStyle(
            color: SaaptTheme.primary,
            fontWeight: FontWeight.w900,
          ),
        ),
        const SizedBox(height: 4),
        Text(
          contact.name,
          style: const TextStyle(
            color: SaaptTheme.navy,
            fontWeight: FontWeight.w800,
          ),
        ),
        const SizedBox(height: 2),
        Text(
          contact.contactNumber,
          style: const TextStyle(
            color: Color(0xFF60708F),
            fontWeight: FontWeight.w700,
          ),
        ),
      ],
    ),
  );
}
