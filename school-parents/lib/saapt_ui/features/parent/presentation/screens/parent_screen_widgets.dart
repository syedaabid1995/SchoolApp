import 'dart:io';
import 'dart:typed_data';

import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';
import 'package:path_provider/path_provider.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../../../app/theme/saapt_theme.dart';
import '../../../../core/config/parent_app_config.dart';
import '../../../../core/network/parent_api_client.dart';
import '../../data/parent_models.dart';
import '../providers/parent_providers.dart';
import 'parent_app_drawer.dart';

class ParentHero extends StatelessWidget {
  const ParentHero({
    super.key,
    required this.badge,
    required this.title,
    required this.subtitle,
    this.leading,
    this.trailing,
    this.showDefaultTrailing = true,
    this.showMenu = false,
    this.showChildSwitcher = false,
    this.titleWidget,
  });

  final String badge;
  final String title;
  final String subtitle;
  final Widget? leading;
  final Widget? trailing;
  final bool showDefaultTrailing;

  /// Opens the side menu via a root route (never [Scaffold.drawer]).
  final bool showMenu;

  /// Shows the selected student name with a dropdown to switch children.
  final bool showChildSwitcher;
  final Widget? titleWidget;

  @override
  Widget build(BuildContext context) {
    final resolvedTitle =
        titleWidget ??
        (showChildSwitcher
            ? ParentChildTitleSwitcher(fallbackTitle: title)
            : null);

    return Container(
      width: double.infinity,
      padding: const EdgeInsets.fromLTRB(22, 52, 22, 24),
      decoration: const BoxDecoration(
        gradient: LinearGradient(
          colors: [Color(0xFF1E4FE8), Color(0xFF346BFF)],
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
        ),
      ),
      child: Stack(
        children: [
          Positioned(
            right: -70,
            top: -70,
            child: Container(
              width: 230,
              height: 230,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                border: Border.all(
                  color: Colors.white.withValues(alpha: 0.18),
                  width: 2,
                ),
              ),
            ),
          ),
          Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  if (leading != null) ...[
                    leading!,
                    const SizedBox(width: 10),
                  ] else if (showMenu) ...[
                    IconButton(
                      tooltip: 'Menu',
                      style: IconButton.styleFrom(
                        backgroundColor: Colors.white.withValues(alpha: 0.16),
                        foregroundColor: Colors.white,
                      ),
                      onPressed: () => showParentAppDrawer(context),
                      icon: const Icon(Icons.menu_rounded),
                    ),
                    const SizedBox(width: 10),
                  ],
                  Container(
                    padding: const EdgeInsets.symmetric(
                      horizontal: 12,
                      vertical: 8,
                    ),
                    decoration: BoxDecoration(
                      color: Colors.white.withValues(alpha: 0.16),
                      borderRadius: BorderRadius.circular(22),
                      border: Border.all(
                        color: Colors.white.withValues(alpha: 0.35),
                      ),
                    ),
                    child: Text(
                      badge,
                      style: const TextStyle(
                        color: Colors.white,
                        fontSize: 12,
                        fontWeight: FontWeight.w900,
                      ),
                    ),
                  ),
                  const Spacer(),
                  if (trailing != null)
                    trailing!
                  else if (showDefaultTrailing)
                    const ParentLogoutAction(),
                ],
              ),
              const SizedBox(height: 22),
              if (resolvedTitle != null)
                resolvedTitle
              else
                Text(
                  title,
                  style: const TextStyle(
                    color: Colors.white,
                    fontSize: 30,
                    height: 1.1,
                    fontWeight: FontWeight.w900,
                  ),
                ),
              const SizedBox(height: 10),
              Text(
                subtitle,
                style: TextStyle(
                  color: Colors.white.withValues(alpha: 0.78),
                  fontSize: 15,
                  fontWeight: FontWeight.w700,
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

/// Sticky [ParentHero] header with a scrollable body underneath.
///
/// Use this on parent screens so the header stays fixed while only the
/// content below scrolls.
class ParentStickyScaffold extends StatelessWidget {
  const ParentStickyScaffold({
    super.key,
    required this.badge,
    required this.title,
    required this.subtitle,
    required this.body,
    this.leading,
    this.trailing,
    this.showDefaultTrailing = true,
    this.showMenu = false,
    this.showChildSwitcher = false,
    this.titleWidget,
    this.onRefresh,
    this.padding = const EdgeInsets.fromLTRB(20, 22, 20, 32),
    this.bottomBar,
    this.backgroundColor,
    this.wrapBody = true,
    this.refreshColor,
  });

  final String badge;
  final String title;
  final String subtitle;
  final Widget body;
  final Widget? leading;
  final Widget? trailing;
  final bool showDefaultTrailing;
  final bool showMenu;
  final bool showChildSwitcher;
  final Widget? titleWidget;
  final Future<void> Function()? onRefresh;
  final EdgeInsetsGeometry padding;
  final Widget? bottomBar;
  final Color? backgroundColor;

  /// When true (default), [body] is placed inside a scrollable [ListView].
  /// Set false when [body] is already a scroll view (e.g. [CustomScrollView]).
  final bool wrapBody;
  final Color? refreshColor;

  @override
  Widget build(BuildContext context) {
    final hero = ParentHero(
      badge: badge,
      title: title,
      subtitle: subtitle,
      leading: leading,
      trailing: trailing,
      showDefaultTrailing: showDefaultTrailing,
      showMenu: showMenu,
      showChildSwitcher: showChildSwitcher,
      titleWidget: titleWidget,
    );

    Widget content = wrapBody
        ? ListView(
            physics: const AlwaysScrollableScrollPhysics(),
            padding: padding,
            children: [body],
          )
        : body;

    if (onRefresh != null) {
      content = RefreshIndicator(
        color: refreshColor,
        onRefresh: onRefresh!,
        child: content,
      );
    }

    return Scaffold(
      backgroundColor: backgroundColor,
      body: Column(
        children: [
          hero,
          Expanded(child: content),
          ?bottomBar,
        ],
      ),
    );
  }
}

class ParentChildTitleSwitcher extends ConsumerWidget {
  const ParentChildTitleSwitcher({super.key, this.fallbackTitle = 'Student'});

  final String fallbackTitle;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final selectedChild = ref.watch(effectiveSelectedChildProvider).asData?.value;
    final children = ref.watch(parentChildrenProvider).asData?.value ?? const [];
    final name = selectedChild?.name.trim().isNotEmpty == true
        ? selectedChild!.name.trim()
        : fallbackTitle;
    final canSwitch = children.isNotEmpty;

    return InkWell(
      onTap: canSwitch
          ? () => showParentChildPicker(
              context,
              ref,
              children: children,
              selected: selectedChild,
            )
          : null,
      borderRadius: BorderRadius.circular(10),
      child: Row(
        children: [
          Expanded(
            child: Text(
              name,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: const TextStyle(
                color: Colors.white,
                fontSize: 30,
                height: 1.1,
                fontWeight: FontWeight.w900,
              ),
            ),
          ),
          if (canSwitch) ...[
            const SizedBox(width: 4),
            Icon(
              Icons.keyboard_arrow_down_rounded,
              color: Colors.white.withValues(alpha: 0.92),
              size: 30,
            ),
          ],
        ],
      ),
    );
  }
}

Future<void> showParentChildPicker(
  BuildContext context,
  WidgetRef ref, {
  required List<ParentChild> children,
  ParentChild? selected,
}) {
  return showModalBottomSheet<void>(
    context: context,
    isScrollControlled: true,
    showDragHandle: true,
    builder: (context) {
      final maxHeight = MediaQuery.sizeOf(context).height * 0.7;
      final selectedId = selected?.id;
      return SafeArea(
        child: ConstrainedBox(
          constraints: BoxConstraints(maxHeight: maxHeight),
          child: Padding(
            padding: const EdgeInsets.fromLTRB(20, 4, 20, 20),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                const Text(
                  'Select Student',
                  style: TextStyle(
                    color: SaaptTheme.navy,
                    fontSize: 22,
                    fontWeight: FontWeight.w900,
                  ),
                ),
                const SizedBox(height: 6),
                Text(
                  DateFormat('d MMM yyyy').format(DateTime.now()),
                  style: const TextStyle(
                    color: Color(0xFF60708F),
                    fontWeight: FontWeight.w700,
                  ),
                ),
                const SizedBox(height: 18),
                Flexible(
                  child: ListView.separated(
                    shrinkWrap: true,
                    itemCount: children.length,
                    separatorBuilder: (_, _) => const SizedBox(height: 12),
                    itemBuilder: (context, index) {
                      final child = children[index];
                      final isSelected = child.id == selectedId;
                      return Material(
                        color: const Color(0xFFF6F8FC),
                        borderRadius: BorderRadius.circular(8),
                        child: InkWell(
                          onTap: () {
                            ref.read(selectedChildIdProvider.notifier).state =
                                child.id;
                            Navigator.of(context).pop();
                          },
                          borderRadius: BorderRadius.circular(8),
                          child: Padding(
                            padding: const EdgeInsets.all(14),
                            child: Row(
                              children: [
                                Container(
                                  width: 44,
                                  height: 44,
                                  decoration: BoxDecoration(
                                    color: const Color(0xFFE7EFFD),
                                    borderRadius: BorderRadius.circular(8),
                                  ),
                                  child: Icon(
                                    isSelected
                                        ? Icons.check_circle_rounded
                                        : Icons.person_outline,
                                    color: SaaptTheme.primary,
                                  ),
                                ),
                                const SizedBox(width: 14),
                                Expanded(
                                  child: Column(
                                    crossAxisAlignment:
                                        CrossAxisAlignment.start,
                                    children: [
                                      Text(
                                        child.name,
                                        style: const TextStyle(
                                          fontWeight: FontWeight.w800,
                                          color: SaaptTheme.navy,
                                        ),
                                      ),
                                      const SizedBox(height: 3),
                                      Text(
                                        child.classLabel,
                                        style: const TextStyle(
                                          color: Color(0xFF60708F),
                                          fontSize: 13,
                                        ),
                                      ),
                                    ],
                                  ),
                                ),
                                const Icon(
                                  Icons.chevron_right,
                                  color: Color(0xFF8A9AB8),
                                ),
                              ],
                            ),
                          ),
                        ),
                      );
                    },
                  ),
                ),
              ],
            ),
          ),
        ),
      );
    },
  );
}

class ParentLogoutAction extends ConsumerWidget {
  const ParentLogoutAction({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return IconButton(
      tooltip: 'Logout',
      style: IconButton.styleFrom(
        backgroundColor: Colors.white.withValues(alpha: 0.16),
        foregroundColor: Colors.white,
      ),
      onPressed: () => confirmParentLogout(context, ref),
      icon: const Icon(Icons.logout_rounded),
    );
  }
}

Future<void> confirmParentLogout(BuildContext context, WidgetRef ref) async {
  final confirmed = await showDialog<bool>(
    context: context,
    builder: (context) {
      return AlertDialog(
        title: const Text(
          'Logout',
          style: TextStyle(fontWeight: FontWeight.w900),
        ),
        content: const Text(
          'Are you sure you want to logout from this app?',
          style: TextStyle(fontWeight: FontWeight.w600),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(context).pop(false),
            child: const Text('Cancel'),
          ),
          FilledButton(
            style: FilledButton.styleFrom(
              backgroundColor: const Color(0xFFEF4C55),
              foregroundColor: Colors.white,
            ),
            onPressed: () => Navigator.of(context).pop(true),
            child: const Text('Logout'),
          ),
        ],
      );
    },
  );
  if (confirmed == true) {
    await ref.read(parentAuthControllerProvider.notifier).logout();
  }
}

class ParentCard extends StatelessWidget {
  const ParentCard({super.key, required this.child, this.padding});

  final Widget child;
  final EdgeInsetsGeometry? padding;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: padding ?? const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: const Color(0xFFDDE7F7)),
        boxShadow: const [
          BoxShadow(
            color: Color(0x0F113B7A),
            blurRadius: 22,
            offset: Offset(0, 8),
          ),
        ],
      ),
      child: child,
    );
  }
}

String resolveParentMediaUrl(String raw) {
  final value = raw.trim();
  if (value.isEmpty) return value;
  if (value.startsWith('http://') || value.startsWith('https://')) return value;

  final apiBase = ParentAppConfig.apiBaseUrl.replaceAll(RegExp(r'/+$'), '');
  final origin = apiBase.replaceFirst(RegExp(r'/api/v1$'), '');

  if (value.startsWith('/api/v1/')) return '$origin$value';
  if (value.startsWith('/uploads/')) return '$origin/api/v1$value';
  if (value.startsWith('/')) return '$apiBase$value';
  return value;
}

String _parentMediaRequestPath(String raw) {
  final resolved = resolveParentMediaUrl(raw);
  final apiBase = ParentAppConfig.apiBaseUrl.replaceAll(RegExp(r'/+$'), '');
  if (resolved.startsWith(apiBase)) {
    final path = resolved.substring(apiBase.length);
    return path.isEmpty ? '/' : path;
  }
  return resolved;
}

Future<List<int>> _loadParentMediaBytes(Dio dio, String rawUrl) async {
  final response = await dio.get<List<int>>(
    _parentMediaRequestPath(rawUrl),
    options: Options(
      responseType: ResponseType.bytes,
      followRedirects: true,
      maxRedirects: 5,
      headers: const {'Accept': '*/*'},
      validateStatus: (status) => status != null && status >= 200 && status < 400,
    ),
  );
  final bytes = response.data;
  if (bytes == null || bytes.isEmpty) {
    throw Exception('Empty media response');
  }
  return bytes;
}

class ParentAuthedImage extends ConsumerStatefulWidget {
  const ParentAuthedImage({
    super.key,
    required this.url,
    this.fit = BoxFit.cover,
    this.errorWidget,
  });

  final String url;
  final BoxFit fit;
  final Widget? errorWidget;

  @override
  ConsumerState<ParentAuthedImage> createState() => _ParentAuthedImageState();
}

class _ParentAuthedImageState extends ConsumerState<ParentAuthedImage> {
  late Future<List<int>> _bytesFuture;

  @override
  void initState() {
    super.initState();
    _bytesFuture = _load();
  }

  @override
  void didUpdateWidget(covariant ParentAuthedImage oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.url != widget.url) {
      _bytesFuture = _load();
    }
  }

  Future<List<int>> _load() {
    return _loadParentMediaBytes(ref.read(parentDioProvider), widget.url);
  }

  @override
  Widget build(BuildContext context) {
    return FutureBuilder<List<int>>(
      future: _bytesFuture,
      builder: (context, snapshot) {
        if (snapshot.connectionState != ConnectionState.done) {
          return const Center(
            child: CircularProgressIndicator(color: SaaptTheme.primary),
          );
        }
        final bytes = snapshot.data;
        if (snapshot.hasError || bytes == null || bytes.isEmpty) {
          return widget.errorWidget ??
              const Center(
                child: Icon(
                  Icons.image_not_supported_outlined,
                  color: SaaptTheme.primary,
                ),
              );
        }
        return Image.memory(
          bytes is Uint8List ? bytes : Uint8List.fromList(bytes),
          fit: widget.fit,
          gaplessPlayback: true,
          errorBuilder: (context, error, stackTrace) =>
              widget.errorWidget ??
              const Center(
                child: Icon(
                  Icons.image_not_supported_outlined,
                  color: SaaptTheme.primary,
                ),
              ),
        );
      },
    );
  }
}

Future<void> openParentProtectedFile(
  WidgetRef ref,
  String rawUrl,
) async {
  final dio = ref.read(parentDioProvider);
  final path = _parentMediaRequestPath(rawUrl);
  final redirectPath = path.contains('?') ? '$path&redirect=1' : '$path?redirect=1';

  try {
    final response = await dio.get<dynamic>(
      redirectPath,
      options: Options(
        followRedirects: false,
        maxRedirects: 0,
        validateStatus: (status) =>
            status != null && status >= 200 && status < 400,
        responseType: ResponseType.bytes,
        headers: const {'Accept': '*/*'},
      ),
    );
    final location = response.headers.value('location');
    if (location != null && location.trim().isNotEmpty) {
      final target = resolveParentMediaUrl(location.trim());
      final launched = await launchUrl(
        Uri.parse(target),
        mode: LaunchMode.externalApplication,
      );
      if (launched) return;
    }
  } catch (_) {
    // Fall through to downloading bytes locally.
  }

  try {
    final bytes = await _loadParentMediaBytes(dio, rawUrl);
    final dir = await getTemporaryDirectory();
    final extension = _guessFileExtension(rawUrl);
    final file = File(
      '${dir.path}/parent_doc_${DateTime.now().millisecondsSinceEpoch}$extension',
    );
    await file.writeAsBytes(bytes, flush: true);
    final launched = await launchUrl(
      Uri.file(file.path),
      mode: LaunchMode.externalApplication,
    );
    if (launched) return;
  } catch (_) {
    // Fall through to direct launch attempt.
  }

  await launchUrl(
    Uri.parse(resolveParentMediaUrl(rawUrl)),
    mode: LaunchMode.externalApplication,
  );
}

String _guessFileExtension(String rawUrl) {
  final path = Uri.tryParse(rawUrl)?.path.toLowerCase() ?? rawUrl.toLowerCase();
  for (final ext in const ['.pdf', '.png', '.jpg', '.jpeg', '.webp', '.gif']) {
    if (path.endsWith(ext)) return ext;
  }
  return '.bin';
}

class LoadingPanel extends StatelessWidget {
  const LoadingPanel({super.key});

  @override
  Widget build(BuildContext context) {
    return const Center(
      child: Padding(
        padding: EdgeInsets.all(48),
        child: CircularProgressIndicator(color: SaaptTheme.primary),
      ),
    );
  }
}

class EmptyPanel extends StatelessWidget {
  const EmptyPanel({super.key, required this.message});

  final String message;

  @override
  Widget build(BuildContext context) {
    return ParentCard(
      child: Text(
        message,
        textAlign: TextAlign.center,
        style: const TextStyle(
          color: Color(0xFF61718D),
          fontWeight: FontWeight.w700,
        ),
      ),
    );
  }
}

class StatCard extends StatelessWidget {
  const StatCard({
    super.key,
    required this.value,
    required this.label,
    this.color = SaaptTheme.primary,
  });

  final String value;
  final String label;
  final Color color;

  @override
  Widget build(BuildContext context) {
    return Expanded(
      child: ParentCard(
        padding: const EdgeInsets.symmetric(vertical: 16, horizontal: 10),
        child: Column(
          children: [
            Text(
              value,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: TextStyle(
                color: color,
                fontSize: 26,
                fontWeight: FontWeight.w900,
              ),
            ),
            const SizedBox(height: 4),
            Text(
              label,
              style: const TextStyle(
                color: Color(0xFF91A1BB),
                fontSize: 12,
                fontWeight: FontWeight.w800,
              ),
            ),
          ],
        ),
      ),
    );
  }
}
