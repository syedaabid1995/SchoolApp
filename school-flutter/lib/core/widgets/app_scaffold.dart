import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../app/routes/app_routes.dart';
import '../../app/theme/app_breakpoints.dart';
import '../../app/theme/app_colors.dart';
import '../../app/theme/app_spacing.dart';
import '../../core/permissions/permission_registry.dart';
import '../../features/auth/presentation/providers/auth_controller.dart';
import '../../features/auth/presentation/providers/current_permission_provider.dart';

class AppScaffold extends ConsumerStatefulWidget {
  const AppScaffold({
    required this.title,
    required this.child,
    this.subtitle,
    this.emoji,
    this.breadcrumb,
    this.actions,
    this.onRefresh,
    super.key,
  });

  final String title;
  final String? subtitle;
  final String? emoji;

  /// Short pill label shown above the title, e.g. "👩🏫 Teacher Dashboard"
  final String? breadcrumb;

  final List<Widget>? actions;
  final Future<void> Function()? onRefresh;

  final dynamic child;

  @override
  ConsumerState<AppScaffold> createState() => _AppScaffoldState();
}

class _AppScaffoldState extends ConsumerState<AppScaffold> {
  final _scaffoldKey = GlobalKey<ScaffoldState>();

  @override
  Widget build(BuildContext context) {
    final maxWidth = AppBreakpoints.contentMaxWidth(context);
    final padding = AppBreakpoints.isCompact(context)
        ? AppSpacing.md
        : AppSpacing.lg;
    final canPop = Navigator.of(context).canPop();

    final body = Align(
      alignment: Alignment.topCenter,
      child: ConstrainedBox(
        constraints: BoxConstraints(maxWidth: maxWidth),
        child: widget.child,
      ),
    );

    final scrollView = widget.onRefresh == null
        ? ListView(
            padding: EdgeInsets.only(
              left: padding,
              right: padding,
              bottom: padding,
            ),
            keyboardDismissBehavior: ScrollViewKeyboardDismissBehavior.onDrag,
            children: [body],
          )
        : RefreshIndicator(
            onRefresh: widget.onRefresh!,
            child: ListView(
              padding: EdgeInsets.only(
                left: padding,
                right: padding,
                bottom: padding,
              ),
              keyboardDismissBehavior: ScrollViewKeyboardDismissBehavior.onDrag,
              children: [body],
            ),
          );

    return Scaffold(
      key: _scaffoldKey,
      backgroundColor: AppColors.pageBackground,
      drawer: canPop ? null : _AppDrawer(scaffoldKey: _scaffoldKey),
      body: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          _GradientHeader(
            title: widget.title,
            subtitle: widget.subtitle,
            emoji: widget.emoji,
            breadcrumb: widget.breadcrumb,
            actions: widget.actions,
            scaffoldKey: canPop ? null : _scaffoldKey,
          ),
          Expanded(child: scrollView),
        ],
      ),
    );
  }
}

// ─── Drawer ──────────────────────────────────────────────────────────────────

class _AppDrawer extends ConsumerWidget {
  const _AppDrawer({required this.scaffoldKey});
  final GlobalKey<ScaffoldState> scaffoldKey;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final authAsync = ref.watch(authControllerProvider);
    final user = authAsync.when(
      data: (s) => s.user,
      loading: () => null,
      error: (_, stackTrace) => null,
    );
    final currentRoute = GoRouterState.of(context).uri.path;
    final checker = ref.watch(currentPermissionCheckerProvider);
    final visibleModules = checker.visibleModules();
    final primaryModules = visibleModules
        .where(
          (module) =>
              module.route != AppRoutes.profile &&
              module.route != AppRoutes.settings,
        )
        .toList(growable: false);
    final profileModule = PermissionRegistry.moduleForRoute(AppRoutes.profile);
    final settingsModule = PermissionRegistry.moduleForRoute(
      AppRoutes.settings,
    );
    final colorScheme = Theme.of(context).colorScheme;
    final textTheme = Theme.of(context).textTheme;

    return Drawer(
      width: 288,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.horizontal(right: Radius.circular(24)),
      ),
      child: Column(
        children: [
          // ── Header ──
          _DrawerHeader(
            displayName: user?.displayName ?? 'Staff Member',
            role: user?.role ?? '',
            schoolName: user?.schoolName ?? '',
            photoUrl: user?.photoUrl,
          ),
          // ── Nav items ──
          Expanded(
            child: ListView(
              padding: const EdgeInsets.symmetric(vertical: AppSpacing.xs),
              children: [
                for (final item in primaryModules)
                  _DrawerNavTile(
                    item: item,
                    isActive: _routeMatches(currentRoute, item.route),
                    onTap: () {
                      scaffoldKey.currentState?.closeDrawer();
                      context.go(item.route);
                    },
                  ),
              ],
            ),
          ),
          // ── Bottom actions ──
          const Divider(height: 1),
          if (profileModule != null && checker.canAccessModule(profileModule))
            _DrawerNavTile(
              item: profileModule,
              isActive: _routeMatches(currentRoute, AppRoutes.profile),
              onTap: () {
                scaffoldKey.currentState?.closeDrawer();
                context.go(AppRoutes.profile);
              },
            ),
          if (settingsModule != null && checker.canAccessModule(settingsModule))
            _DrawerNavTile(
              item: settingsModule,
              isActive: _routeMatches(currentRoute, AppRoutes.settings),
              onTap: () {
                scaffoldKey.currentState?.closeDrawer();
                context.go(AppRoutes.settings);
              },
            ),
          ListTile(
            leading: Container(
              width: 36,
              height: 36,
              decoration: BoxDecoration(
                color: colorScheme.errorContainer,
                borderRadius: BorderRadius.circular(10),
              ),
              child: Icon(
                Icons.logout,
                size: 18,
                color: colorScheme.onErrorContainer,
              ),
            ),
            title: Text(
              'Logout',
              style: textTheme.bodyMedium?.copyWith(
                fontWeight: FontWeight.w500,
                color: colorScheme.error,
              ),
            ),
            onTap: () {
              scaffoldKey.currentState?.closeDrawer();
              ref.read(authControllerProvider.notifier).logout();
            },
          ),
          SizedBox(
            height: MediaQuery.of(context).padding.bottom + AppSpacing.sm,
          ),
        ],
      ),
    );
  }

  bool _routeMatches(String currentRoute, String route) =>
      currentRoute == route || currentRoute.startsWith('$route/');
}

class _DrawerHeader extends StatelessWidget {
  const _DrawerHeader({
    required this.displayName,
    required this.role,
    required this.schoolName,
    this.photoUrl,
  });

  final String displayName;
  final String role;
  final String schoolName;
  final String? photoUrl;

  @override
  Widget build(BuildContext context) {
    final topPad = MediaQuery.of(context).padding.top;
    final initials = displayName
        .trim()
        .split(' ')
        .take(2)
        .map((w) => w.isEmpty ? '' : w[0].toUpperCase())
        .join();

    return Container(
      padding: EdgeInsets.only(
        top: topPad + AppSpacing.lg,
        left: AppSpacing.md,
        right: AppSpacing.md,
        bottom: AppSpacing.lg,
      ),
      decoration: const BoxDecoration(
        gradient: LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: [Color(0xFF2B4EFF), Color(0xFF5B3FE8), Color(0xFF6B3FFF)],
        ),
        borderRadius: BorderRadius.only(
          topRight: Radius.circular(24),
          bottomLeft: Radius.circular(20),
          bottomRight: Radius.circular(20),
        ),
      ),
      child: Row(
        children: [
          CircleAvatar(
            radius: 28,
            backgroundColor: Colors.white.withOpacity(0.25),
            backgroundImage: photoUrl != null ? NetworkImage(photoUrl!) : null,
            child: photoUrl == null
                ? Text(
                    initials,
                    style: const TextStyle(
                      color: Colors.white,
                      fontWeight: FontWeight.w700,
                      fontSize: 18,
                    ),
                  )
                : null,
          ),
          const SizedBox(width: AppSpacing.sm),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  displayName,
                  style: const TextStyle(
                    color: Colors.white,
                    fontWeight: FontWeight.w700,
                    fontSize: 15,
                  ),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                ),
                if (role.isNotEmpty)
                  Text(
                    role,
                    style: TextStyle(
                      color: Colors.white.withOpacity(0.80),
                      fontSize: 12,
                      fontWeight: FontWeight.w500,
                    ),
                  ),
                if (schoolName.isNotEmpty)
                  Text(
                    schoolName,
                    style: TextStyle(
                      color: Colors.white.withOpacity(0.65),
                      fontSize: 11,
                    ),
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                  ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _DrawerNavTile extends StatelessWidget {
  const _DrawerNavTile({
    required this.item,
    required this.isActive,
    required this.onTap,
  });

  final StaffModuleDefinition item;
  final bool isActive;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final colorScheme = Theme.of(context).colorScheme;
    final textTheme = Theme.of(context).textTheme;

    return Padding(
      padding: const EdgeInsets.symmetric(
        horizontal: AppSpacing.sm,
        vertical: 2,
      ),
      child: Material(
        color: isActive ? colorScheme.primaryContainer : Colors.transparent,
        borderRadius: BorderRadius.circular(12),
        child: InkWell(
          borderRadius: BorderRadius.circular(12),
          onTap: onTap,
          child: Padding(
            padding: const EdgeInsets.symmetric(
              horizontal: AppSpacing.sm,
              vertical: AppSpacing.xs,
            ),
            child: Row(
              children: [
                Container(
                  width: 36,
                  height: 36,
                  decoration: BoxDecoration(
                    color: isActive
                        ? colorScheme.primary.withOpacity(0.15)
                        : colorScheme.surfaceContainerHighest,
                    borderRadius: BorderRadius.circular(10),
                  ),
                  child: Icon(
                    isActive ? item.activeIcon : item.icon,
                    size: 18,
                    color: isActive
                        ? colorScheme.primary
                        : colorScheme.onSurface.withOpacity(0.65),
                  ),
                ),
                const SizedBox(width: AppSpacing.sm),
                Text(
                  item.displayName,
                  style: textTheme.bodyMedium?.copyWith(
                    fontWeight: isActive ? FontWeight.w700 : FontWeight.w500,
                    color: isActive
                        ? colorScheme.primary
                        : colorScheme.onSurface,
                  ),
                ),
                if (isActive) ...[
                  const Spacer(),
                  Container(
                    width: 4,
                    height: 4,
                    decoration: BoxDecoration(
                      color: colorScheme.primary,
                      shape: BoxShape.circle,
                    ),
                  ),
                ],
              ],
            ),
          ),
        ),
      ),
    );
  }
}

// ─── Header ──────────────────────────────────────────────────────────────────

class _GradientHeader extends StatelessWidget {
  const _GradientHeader({
    required this.title,
    this.subtitle,
    this.emoji,
    this.breadcrumb,
    this.actions,
    this.scaffoldKey,
  });

  final String title;
  final String? subtitle;
  final String? emoji;
  final String? breadcrumb;
  final List<Widget>? actions;
  final GlobalKey<ScaffoldState>? scaffoldKey;

  @override
  Widget build(BuildContext context) {
    final topPad = MediaQuery.of(context).padding.top;
    final textTheme = Theme.of(context).textTheme;
    final canPop = Navigator.of(context).canPop();

    return Container(
      decoration: const BoxDecoration(
        gradient: LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: [Color(0xFF2B4EFF), Color(0xFF5B3FE8), Color(0xFF6B3FFF)],
        ),
        borderRadius: BorderRadius.vertical(bottom: Radius.circular(32)),
      ),
      child: Stack(
        children: [
          Positioned(
            right: -30,
            top: topPad + 10,
            child: Container(
              width: 160,
              height: 160,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                color: Colors.white.withOpacity(0.06),
              ),
            ),
          ),
          Positioned(
            right: 40,
            bottom: 10,
            child: Container(
              width: 80,
              height: 80,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                color: Colors.white.withOpacity(0.05),
              ),
            ),
          ),
          Padding(
            padding: EdgeInsets.only(
              top: topPad + AppSpacing.sm,
              left: AppSpacing.md,
              right: AppSpacing.md,
              bottom: AppSpacing.lg,
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    if (canPop)
                      IconButton(
                        icon: const Icon(
                          Icons.arrow_back_ios_new_rounded,
                          color: Colors.white,
                          size: 20,
                        ),
                        onPressed: () => Navigator.of(context).pop(),
                        padding: EdgeInsets.zero,
                        constraints: const BoxConstraints(),
                      )
                    else
                      IconButton(
                        icon: const Icon(
                          Icons.menu_rounded,
                          color: Colors.white,
                          size: 24,
                        ),
                        onPressed: () =>
                            scaffoldKey?.currentState?.openDrawer(),
                        padding: EdgeInsets.zero,
                        constraints: const BoxConstraints(),
                        tooltip: 'Open menu',
                      ),
                    if (breadcrumb != null)
                      Padding(
                        padding: const EdgeInsets.only(left: AppSpacing.xs),
                        child: _BreadcrumbPill(label: breadcrumb!),
                      ),
                    const Spacer(),
                    if (actions != null)
                      ...actions!.map(
                        (a) => IconTheme(
                          data: const IconThemeData(color: Colors.white),
                          child: a,
                        ),
                      ),
                  ],
                ),
                const SizedBox(height: AppSpacing.sm),
                Row(
                  crossAxisAlignment: CrossAxisAlignment.center,
                  children: [
                    if (emoji != null) ...[
                      Text(emoji!, style: const TextStyle(fontSize: 32)),
                      const SizedBox(width: AppSpacing.sm),
                    ],
                    Expanded(
                      child: Text(
                        title,
                        style: textTheme.headlineMedium?.copyWith(
                          color: Colors.white,
                          fontWeight: FontWeight.w800,
                          height: 1.1,
                        ),
                      ),
                    ),
                  ],
                ),
                if (subtitle != null) ...[
                  const SizedBox(height: AppSpacing.xs),
                  Text(
                    subtitle!,
                    style: textTheme.bodyMedium?.copyWith(
                      color: Colors.white.withOpacity(0.80),
                      height: 1.4,
                    ),
                  ),
                ],
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _BreadcrumbPill extends StatelessWidget {
  const _BreadcrumbPill({required this.label});
  final String label;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(
        horizontal: AppSpacing.sm,
        vertical: AppSpacing.xxs + 2,
      ),
      decoration: BoxDecoration(
        color: Colors.white.withOpacity(0.18),
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: Colors.white.withOpacity(0.25)),
      ),
      child: Text(
        label,
        style: Theme.of(context).textTheme.labelSmall?.copyWith(
          color: Colors.white,
          fontWeight: FontWeight.w600,
        ),
      ),
    );
  }
}
