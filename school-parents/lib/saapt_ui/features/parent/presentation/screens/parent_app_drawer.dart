import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../../app/theme/saapt_theme.dart';
import '../providers/parent_providers.dart';

/// Slide-in side menu that does **not** use [Scaffold.drawer].
///
/// Nested `Scaffold.drawer` under the bottom-nav shell freezes Android scroll
/// gestures after the menu is opened (ANR). This route sits on the root
/// navigator and leaves tab scrollables untouched.
Future<void> showParentAppDrawer(BuildContext context) {
  final width = (MediaQuery.sizeOf(context).width * 0.82).clamp(260.0, 340.0);

  return Navigator.of(context, rootNavigator: true).push<void>(
    PageRouteBuilder<void>(
      opaque: false,
      barrierDismissible: true,
      barrierLabel: 'Menu',
      barrierColor: Colors.black.withValues(alpha: 0.45),
      transitionDuration: const Duration(milliseconds: 220),
      reverseTransitionDuration: const Duration(milliseconds: 180),
      pageBuilder: (context, animation, secondaryAnimation) {
        return Align(
          alignment: Alignment.centerLeft,
          child: Material(
            color: Colors.white,
            elevation: 12,
            clipBehavior: Clip.antiAlias,
            borderRadius: const BorderRadius.horizontal(
              right: Radius.circular(20),
            ),
            child: SizedBox(
              width: width,
              height: double.infinity,
              child: const SafeArea(
                right: false,
                child: ParentAppDrawerPanel(),
              ),
            ),
          ),
        );
      },
      transitionsBuilder: (context, animation, secondaryAnimation, child) {
        final curved = CurvedAnimation(
          parent: animation,
          curve: Curves.easeOutCubic,
          reverseCurve: Curves.easeInCubic,
        );
        return SlideTransition(
          position: Tween<Offset>(
            begin: const Offset(-1, 0),
            end: Offset.zero,
          ).animate(curved),
          child: child,
        );
      },
    ),
  );
}

class ParentAppDrawerPanel extends ConsumerWidget {
  const ParentAppDrawerPanel({super.key});

  void _closeAndGo(BuildContext context, String location) {
    final router = GoRouter.of(context);
    Navigator.of(context, rootNavigator: true).pop();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      router.push(location);
    });
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final profileState = ref.watch(parentProfileProvider);
    final profile = profileState.asData?.value;
    final name = profile?.name.trim().isNotEmpty == true
        ? profile!.name.trim()
        : 'Parent';
    final email = profile?.email.trim() ?? '';
    final initial = name.isEmpty ? 'P' : name[0].toUpperCase();

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Container(
          padding: const EdgeInsets.fromLTRB(20, 24, 20, 22),
          decoration: const BoxDecoration(
            gradient: LinearGradient(
              colors: [Color(0xFF1E4FE8), Color(0xFF346BFF)],
              begin: Alignment.topLeft,
              end: Alignment.bottomRight,
            ),
          ),
          child: Row(
            children: [
              CircleAvatar(
                radius: 28,
                backgroundColor: Colors.white.withValues(alpha: 0.18),
                child: Text(
                  initial,
                  style: const TextStyle(
                    color: Colors.white,
                    fontSize: 22,
                    fontWeight: FontWeight.w900,
                  ),
                ),
              ),
              const SizedBox(width: 14),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      name,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: const TextStyle(
                        color: Colors.white,
                        fontSize: 18,
                        fontWeight: FontWeight.w900,
                      ),
                    ),
                    if (email.isNotEmpty) ...[
                      const SizedBox(height: 4),
                      Text(
                        email,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: TextStyle(
                          color: Colors.white.withValues(alpha: 0.82),
                          fontWeight: FontWeight.w700,
                          fontSize: 12,
                        ),
                      ),
                    ],
                  ],
                ),
              ),
              IconButton(
                tooltip: 'Close',
                onPressed: () =>
                    Navigator.of(context, rootNavigator: true).pop(),
                icon: const Icon(Icons.close_rounded, color: Colors.white),
              ),
            ],
          ),
        ),
        const Padding(
          padding: EdgeInsets.fromLTRB(20, 18, 20, 8),
          child: Text(
            'Menu',
            style: TextStyle(
              color: Color(0xFF8EA0BA),
              fontSize: 12,
              fontWeight: FontWeight.w900,
            ),
          ),
        ),
        Expanded(
          child: ListView(
            padding: const EdgeInsets.fromLTRB(10, 0, 10, 16),
            children: [
              _DrawerMenuTile(
                icon: Icons.apartment_outlined,
                title: 'School Profile',
                subtitle: 'School address and contact information',
                onTap: () => _closeAndGo(context, '/profile?panel=school'),
              ),
              _DrawerMenuTile(
                icon: Icons.family_restroom_outlined,
                title: 'Children',
                subtitle: profile == null
                    ? 'Mapped child profiles'
                    : '${profile.children.length} mapped child profiles',
                onTap: () => _closeAndGo(context, '/profile?panel=children'),
              ),
              _DrawerMenuTile(
                icon: Icons.payments_outlined,
                title: 'Online Fee Payment',
                subtitle: 'Fee breakdown and pay online',
                onTap: () => _closeAndGo(context, '/fees/online'),
              ),
            ],
          ),
        ),
        const Divider(height: 1),
        _DrawerMenuTile(
          icon: Icons.person_outline,
          title: 'Account',
          subtitle: 'Profile, password, and settings',
          onTap: () => _closeAndGo(context, '/profile'),
        ),
        const SizedBox(height: 8),
      ],
    );
  }
}

class _DrawerMenuTile extends StatelessWidget {
  const _DrawerMenuTile({
    required this.icon,
    required this.title,
    required this.subtitle,
    required this.onTap,
  });

  final IconData icon;
  final String title;
  final String subtitle;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return ListTile(
      onTap: onTap,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
      leading: Container(
        width: 40,
        height: 40,
        alignment: Alignment.center,
        decoration: BoxDecoration(
          color: const Color(0xFFEAF1FF),
          borderRadius: BorderRadius.circular(12),
        ),
        child: Icon(icon, color: SaaptTheme.primary, size: 22),
      ),
      title: Text(
        title,
        style: const TextStyle(
          color: SaaptTheme.navy,
          fontWeight: FontWeight.w900,
          fontSize: 15,
        ),
      ),
      subtitle: Text(
        subtitle,
        maxLines: 2,
        overflow: TextOverflow.ellipsis,
        style: const TextStyle(
          color: Color(0xFF60708F),
          fontWeight: FontWeight.w700,
          fontSize: 12,
        ),
      ),
      trailing: const Icon(
        Icons.chevron_right_rounded,
        color: Color(0xFF8EA0BA),
      ),
    );
  }
}
