import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../theme/prototype_colors.dart';

class PrototypeScaffold extends StatelessWidget {
  const PrototypeScaffold({
    super.key,
    required this.children,
    this.hero,
    this.bottomNavigation,
    this.padding = const EdgeInsets.all(18),
    this.centerContent = false,
  });

  final List<Widget> children;
  final Widget? hero;
  final Widget? bottomNavigation;
  final EdgeInsets padding;
  final bool centerContent;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Colors.white,
      body: SafeArea(
        child: Column(
          children: [
            ?hero,
            Expanded(
              child: DecoratedBox(
                decoration: const BoxDecoration(color: PrototypeColors.surface),
                child: ListView(
                  padding: padding,
                  children: centerContent
                      ? [
                          SizedBox(
                            height: MediaQuery.sizeOf(context).height * 0.08,
                          ),
                          ...children,
                        ]
                      : children,
                ),
              ),
            ),
            ?bottomNavigation,
          ],
        ),
      ),
    );
  }
}

class PrototypeLogo extends StatelessWidget {
  const PrototypeLogo({super.key, this.text = 'SA', this.icon});

  final String text;
  final IconData? icon;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: 72,
      height: 72,
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(22),
        gradient: const LinearGradient(
          colors: [PrototypeColors.blueDark, PrototypeColors.blue],
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
        ),
        boxShadow: const [
          BoxShadow(
            color: Color(0x471A56F0),
            blurRadius: 36,
            offset: Offset(0, 12),
          ),
        ],
      ),
      child: Center(
        child: icon == null
            ? Text(
                text,
                style: const TextStyle(
                  color: Colors.white,
                  fontSize: 22,
                  fontWeight: FontWeight.w900,
                ),
              )
            : Icon(icon, color: Colors.white, size: 30),
      ),
    );
  }
}

class PrototypeHero extends StatelessWidget {
  const PrototypeHero({
    super.key,
    required this.label,
    required this.title,
    required this.subtitle,
    this.icon,
  });

  final String label;
  final String title;
  final String subtitle;
  final IconData? icon;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.fromLTRB(24, 48, 24, 24),
      decoration: const BoxDecoration(
        gradient: LinearGradient(
          colors: [
            PrototypeColors.blueDark,
            PrototypeColors.blue,
            Color(0xFF3B7BFF),
          ],
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
        ),
      ),
      child: Stack(
        children: [
          Positioned(
            right: -84,
            top: -94,
            child: Container(
              width: 230,
              height: 230,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                color: Colors.white.withValues(alpha: 0.06),
                border: Border.all(color: Colors.white.withValues(alpha: 0.15)),
              ),
            ),
          ),
          Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Container(
                padding: const EdgeInsets.symmetric(
                  horizontal: 12,
                  vertical: 5,
                ),
                decoration: BoxDecoration(
                  color: Colors.white.withValues(alpha: 0.16),
                  borderRadius: BorderRadius.circular(99),
                  border: Border.all(
                    color: Colors.white.withValues(alpha: 0.25),
                  ),
                ),
                child: Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    if (icon != null) ...[
                      Icon(icon, size: 14, color: Colors.white),
                      const SizedBox(width: 6),
                    ],
                    Text(
                      label,
                      style: const TextStyle(
                        color: Colors.white,
                        fontSize: 11,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 10),
              Text(
                title,
                style: const TextStyle(
                  color: Colors.white,
                  fontSize: 24,
                  height: 1.15,
                  fontWeight: FontWeight.w800,
                ),
              ),
              const SizedBox(height: 6),
              Text(
                subtitle,
                style: TextStyle(
                  color: Colors.white.withValues(alpha: 0.72),
                  fontSize: 13,
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

class PrototypeCard extends StatelessWidget {
  const PrototypeCard({
    super.key,
    required this.child,
    this.variant = PrototypeCardVariant.white,
    this.padding = const EdgeInsets.all(18),
  });

  final Widget child;
  final PrototypeCardVariant variant;
  final EdgeInsets padding;

  @override
  Widget build(BuildContext context) {
    final (background, border) = switch (variant) {
      PrototypeCardVariant.white => (Colors.white, PrototypeColors.border),
      PrototypeCardVariant.blue => (
        PrototypeColors.blueSoft,
        PrototypeColors.blueBorder,
      ),
      PrototypeCardVariant.green => (
        PrototypeColors.greenSoft,
        const Color(0x3300B87A),
      ),
      PrototypeCardVariant.orange => (
        PrototypeColors.orangeSoft,
        const Color(0x33F59E0B),
      ),
    };

    return Container(
      padding: padding,
      decoration: BoxDecoration(
        color: background,
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: border),
        boxShadow: const [
          BoxShadow(
            color: Color(0x0F1A56F0),
            blurRadius: 8,
            offset: Offset(0, 2),
          ),
        ],
      ),
      child: child,
    );
  }
}

enum PrototypeCardVariant { white, blue, green, orange }

class PrototypeButton extends StatelessWidget {
  const PrototypeButton({
    super.key,
    required this.label,
    required this.onPressed,
    this.icon,
    this.green = false,
  });

  final String label;
  final VoidCallback? onPressed;
  final IconData? icon;
  final bool green;

  @override
  Widget build(BuildContext context) {
    final colors = green
        ? const [PrototypeColors.greenDark, PrototypeColors.green]
        : const [PrototypeColors.blueDark, PrototypeColors.blue];
    return DecoratedBox(
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(15),
        gradient: LinearGradient(colors: colors),
        boxShadow: [
          BoxShadow(
            color: (green ? PrototypeColors.green : PrototypeColors.blue)
                .withValues(alpha: 0.25),
            blurRadius: 36,
            offset: const Offset(0, 12),
          ),
        ],
      ),
      child: FilledButton.icon(
        onPressed: onPressed,
        style: FilledButton.styleFrom(
          backgroundColor: Colors.transparent,
          shadowColor: Colors.transparent,
          minimumSize: const Size.fromHeight(52),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(15),
          ),
        ),
        icon: icon == null ? const SizedBox.shrink() : Icon(icon, size: 18),
        label: Text(label, style: const TextStyle(fontWeight: FontWeight.w700)),
      ),
    );
  }
}

class PrototypeLabel extends StatelessWidget {
  const PrototypeLabel(this.text, {super.key});

  final String text;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 8),
      child: Text(
        text.toUpperCase(),
        style: const TextStyle(
          color: PrototypeColors.mutedLight,
          fontSize: 10,
          letterSpacing: 0.8,
          fontWeight: FontWeight.w800,
        ),
      ),
    );
  }
}

class FieldPreview extends StatelessWidget {
  const FieldPreview({
    super.key,
    required this.text,
    this.trailing,
    this.selected = false,
  });

  final String text;
  final IconData? trailing;
  final bool selected;

  @override
  Widget build(BuildContext context) {
    return Container(
      height: 50,
      margin: const EdgeInsets.only(bottom: 12),
      padding: const EdgeInsets.symmetric(horizontal: 15),
      decoration: BoxDecoration(
        color: selected ? PrototypeColors.blueSoft : PrototypeColors.surface,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(
          color: selected ? PrototypeColors.blue : PrototypeColors.border,
          width: 1.5,
        ),
      ),
      child: Row(
        children: [
          Expanded(
            child: Text(
              text,
              overflow: TextOverflow.ellipsis,
              style: TextStyle(
                color: selected ? PrototypeColors.blue : PrototypeColors.text,
                fontWeight: FontWeight.w600,
                fontSize: 14,
              ),
            ),
          ),
          if (trailing != null)
            Icon(
              trailing,
              size: 18,
              color: selected ? PrototypeColors.blue : PrototypeColors.muted,
            ),
        ],
      ),
    );
  }
}

class StatGrid extends StatelessWidget {
  const StatGrid({super.key, required this.children});

  final List<Widget> children;

  @override
  Widget build(BuildContext context) {
    return GridView.count(
      shrinkWrap: true,
      physics: const NeverScrollableScrollPhysics(),
      crossAxisCount: children.length == 3 ? 3 : 2,
      crossAxisSpacing: 10,
      mainAxisSpacing: 10,
      childAspectRatio: children.length == 3 ? 1.05 : 1.45,
      children: children,
    );
  }
}

class StatCard extends StatelessWidget {
  const StatCard({
    super.key,
    required this.value,
    required this.label,
    required this.color,
  });

  final String value;
  final String label;
  final Color color;

  @override
  Widget build(BuildContext context) {
    return PrototypeCard(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 14),
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Text(
            value,
            maxLines: 1,
            style: TextStyle(
              color: color,
              fontSize: 25,
              height: 1,
              fontWeight: FontWeight.w900,
            ),
          ),
          const SizedBox(height: 5),
          Text(
            label,
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
            style: const TextStyle(
              color: PrototypeColors.mutedLight,
              fontSize: 11,
            ),
          ),
        ],
      ),
    );
  }
}

class SectionTitle extends StatelessWidget {
  const SectionTitle(this.title, {super.key, this.action});

  final String title;
  final String? action;

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        Expanded(
          child: Text(
            title,
            style: const TextStyle(fontSize: 15, fontWeight: FontWeight.w800),
          ),
        ),
        if (action != null)
          Text(
            action!,
            style: const TextStyle(
              color: PrototypeColors.blue,
              fontSize: 12,
              fontWeight: FontWeight.w600,
            ),
          ),
      ],
    );
  }
}

class StatusTag extends StatelessWidget {
  const StatusTag({super.key, required this.label, required this.color});

  final String label;
  final Color color;

  @override
  Widget build(BuildContext context) {
    final background = switch (color) {
      PrototypeColors.green => PrototypeColors.greenSoft,
      PrototypeColors.red => PrototypeColors.redSoft,
      PrototypeColors.orange => PrototypeColors.orangeSoft,
      _ => PrototypeColors.blueSoft,
    };
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 5),
      decoration: BoxDecoration(
        color: background,
        borderRadius: BorderRadius.circular(99),
        border: Border.all(color: color.withValues(alpha: 0.2)),
      ),
      child: Text(
        label,
        style: TextStyle(
          color: color,
          fontSize: 11,
          fontWeight: FontWeight.w700,
        ),
      ),
    );
  }
}

class PrototypeRow extends StatelessWidget {
  const PrototypeRow({
    super.key,
    required this.icon,
    required this.title,
    required this.subtitle,
    this.tag,
    this.highlight = false,
  });

  final IconData icon;
  final String title;
  final String subtitle;
  final Widget? tag;
  final bool highlight;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: highlight ? PrototypeColors.blueSoft : Colors.white,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(
          color: highlight
              ? PrototypeColors.blueBorder
              : PrototypeColors.border,
        ),
        boxShadow: const [
          BoxShadow(
            color: Color(0x0F1A56F0),
            blurRadius: 8,
            offset: Offset(0, 2),
          ),
        ],
      ),
      child: Row(
        children: [
          Container(
            width: 44,
            height: 44,
            decoration: BoxDecoration(
              color: PrototypeColors.blueSoft,
              borderRadius: BorderRadius.circular(13),
              border: Border.all(color: PrototypeColors.blueBorder),
            ),
            child: Icon(icon, color: PrototypeColors.blue, size: 21),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  title,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: const TextStyle(
                    fontSize: 14,
                    fontWeight: FontWeight.w700,
                  ),
                ),
                const SizedBox(height: 2),
                Text(
                  subtitle,
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                  style: const TextStyle(
                    fontSize: 12,
                    color: PrototypeColors.muted,
                  ),
                ),
              ],
            ),
          ),
          if (tag != null) ...[const SizedBox(width: 10), tag!],
        ],
      ),
    );
  }
}

class SessionBottomNav extends StatelessWidget {
  const SessionBottomNav({super.key, required this.activeIndex});

  final int activeIndex;

  @override
  Widget build(BuildContext context) {
    final items = [
      (Icons.home_outlined, 'Home', '/dashboard'),
      (Icons.camera_alt_outlined, 'Students', '/module/student-attendance'),
      (Icons.insert_chart_outlined, 'Reports', '/module/reports'),
      (Icons.person_outline, 'Profile', '/profile'),
    ];

    return Container(
      height: 72,
      decoration: const BoxDecoration(
        color: Colors.white,
        border: Border(top: BorderSide(color: PrototypeColors.border)),
      ),
      child: Row(
        children: [
          for (var index = 0; index < items.length; index++)
            Expanded(
              child: InkWell(
                onTap: () => context.go(items[index].$3),
                child: _NavItem(
                  icon: items[index].$1,
                  label: items[index].$2,
                  active: activeIndex == index,
                ),
              ),
            ),
        ],
      ),
    );
  }
}

class _NavItem extends StatelessWidget {
  const _NavItem({
    required this.icon,
    required this.label,
    required this.active,
  });

  final IconData icon;
  final String label;
  final bool active;

  @override
  Widget build(BuildContext context) {
    final color = active ? PrototypeColors.blue : PrototypeColors.mutedLight;
    return Column(
      mainAxisAlignment: MainAxisAlignment.center,
      children: [
        Container(
          width: 40,
          height: 36,
          decoration: BoxDecoration(
            color: active ? PrototypeColors.blueSoft : Colors.transparent,
            borderRadius: BorderRadius.circular(12),
            border: active
                ? Border.all(color: PrototypeColors.blueBorder)
                : null,
          ),
          child: Icon(icon, color: color, size: 21),
        ),
        const SizedBox(height: 3),
        Text(
          label,
          style: TextStyle(
            color: color,
            fontSize: 10,
            fontWeight: FontWeight.w700,
          ),
        ),
      ],
    );
  }
}

class TabPills extends StatelessWidget {
  const TabPills({super.key, required this.left, required this.right});

  final String left;
  final String right;

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        Expanded(child: _TabPill(label: left, active: true)),
        const SizedBox(width: 10),
        Expanded(child: _TabPill(label: right, active: false)),
      ],
    );
  }
}

class _TabPill extends StatelessWidget {
  const _TabPill({required this.label, required this.active});

  final String label;
  final bool active;

  @override
  Widget build(BuildContext context) {
    return Container(
      height: 44,
      decoration: BoxDecoration(
        color: active ? PrototypeColors.blueSoft : Colors.white,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(
          color: active ? PrototypeColors.blueBorder : PrototypeColors.border,
        ),
      ),
      child: Center(
        child: Text(
          label,
          style: TextStyle(
            color: active ? PrototypeColors.blue : PrototypeColors.muted,
            fontSize: 13,
            fontWeight: FontWeight.w700,
          ),
        ),
      ),
    );
  }
}

class MiniCalendar extends StatelessWidget {
  const MiniCalendar({super.key});

  @override
  Widget build(BuildContext context) {
    const labels = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
    final dates = [
      ('1', PrototypeColors.greenSoft, PrototypeColors.green),
      ('2', PrototypeColors.greenSoft, PrototypeColors.green),
      ('3', PrototypeColors.surface, PrototypeColors.muted),
      ('4', PrototypeColors.greenSoft, PrototypeColors.green),
      ('5', PrototypeColors.greenSoft, PrototypeColors.green),
      ('6', PrototypeColors.redSoft, PrototypeColors.red),
      ('7', PrototypeColors.surface, PrototypeColors.muted),
      ('8', PrototypeColors.greenSoft, PrototypeColors.green),
      ('9', PrototypeColors.greenSoft, PrototypeColors.green),
      ('10', PrototypeColors.greenSoft, PrototypeColors.green),
      ('11', PrototypeColors.surface, PrototypeColors.muted),
      ('12', PrototypeColors.greenSoft, PrototypeColors.green),
      ('13', PrototypeColors.greenSoft, PrototypeColors.green),
      ('15', PrototypeColors.blue, Colors.white),
    ];

    return PrototypeCard(
      child: GridView.count(
        shrinkWrap: true,
        physics: const NeverScrollableScrollPhysics(),
        crossAxisCount: 7,
        crossAxisSpacing: 6,
        mainAxisSpacing: 6,
        children: [
          for (final label in labels)
            Center(
              child: Text(
                label,
                style: const TextStyle(
                  color: PrototypeColors.mutedLight,
                  fontSize: 11,
                ),
              ),
            ),
          for (final date in dates)
            Container(
              decoration: BoxDecoration(
                color: date.$2,
                borderRadius: BorderRadius.circular(10),
              ),
              child: Center(
                child: Text(
                  date.$1,
                  style: TextStyle(
                    color: date.$3,
                    fontSize: 11,
                    fontWeight: FontWeight.w700,
                  ),
                ),
              ),
            ),
        ],
      ),
    );
  }
}

class BarChartCard extends StatelessWidget {
  const BarChartCard({super.key, required this.title});

  final String title;

  @override
  Widget build(BuildContext context) {
    final bars = [
      ('Mon', 96.0, PrototypeColors.green),
      ('Tue', 86.0, PrototypeColors.blue),
      ('Wed', 72.0, PrototypeColors.orange),
      ('Thu', 90.0, PrototypeColors.blue),
    ];

    return PrototypeCard(
      padding: const EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            title,
            style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w800),
          ),
          const SizedBox(height: 12),
          SizedBox(
            height: 120,
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.end,
              children: [
                for (final bar in bars) ...[
                  Expanded(
                    child: Column(
                      mainAxisAlignment: MainAxisAlignment.end,
                      children: [
                        Container(
                          height: bar.$2,
                          decoration: BoxDecoration(
                            borderRadius: const BorderRadius.vertical(
                              top: Radius.circular(10),
                              bottom: Radius.circular(4),
                            ),
                            gradient: LinearGradient(
                              colors: [bar.$3, bar.$3.withValues(alpha: 0.45)],
                              begin: Alignment.topCenter,
                              end: Alignment.bottomCenter,
                            ),
                          ),
                        ),
                        const SizedBox(height: 6),
                        Text(
                          bar.$1,
                          style: const TextStyle(
                            color: PrototypeColors.muted,
                            fontSize: 10,
                            fontWeight: FontWeight.w700,
                          ),
                        ),
                      ],
                    ),
                  ),
                  if (bar != bars.last) const SizedBox(width: 10),
                ],
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class ScanMock extends StatelessWidget {
  const ScanMock({super.key});

  @override
  Widget build(BuildContext context) {
    return Container(
      height: 255,
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(18),
        border: Border.all(color: PrototypeColors.blueBorder, width: 1.5),
        gradient: const LinearGradient(
          colors: [Color(0xFFEAF2FF), Color(0xFFF0F7FF)],
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
        ),
      ),
      child: Stack(
        children: [
          Positioned(
            left: 0,
            right: 0,
            top: 118,
            child: Container(
              height: 2,
              decoration: BoxDecoration(
                gradient: LinearGradient(
                  colors: [
                    Colors.transparent,
                    PrototypeColors.blue.withValues(alpha: 0.9),
                    Colors.transparent,
                  ],
                ),
                boxShadow: const [
                  BoxShadow(color: Color(0x801A56F0), blurRadius: 16),
                ],
              ),
            ),
          ),
          const Positioned(
            left: 10,
            top: 25,
            child: _FaceBadge(name: 'Chezhiyan', score: '98%'),
          ),
          const Positioned(
            left: 112,
            top: 14,
            child: _FaceBadge(name: 'Ashwin', score: '97%'),
          ),
          const Positioned(
            right: 10,
            top: 30,
            child: _FaceBadge(name: 'Syed', score: '96%'),
          ),
          const Positioned(
            left: 22,
            bottom: 30,
            child: _FaceBadge(name: 'Mohideen', score: '95%'),
          ),
          const Positioned(
            right: 22,
            bottom: 30,
            child: _FaceBadge(name: 'Jagadesh', score: '99%'),
          ),
          Positioned(
            left: 0,
            right: 0,
            bottom: 0,
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 9),
              decoration: BoxDecoration(
                color: Colors.white.withValues(alpha: 0.9),
                border: const Border(
                  top: BorderSide(color: PrototypeColors.border),
                ),
              ),
              child: const Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Text(
                    'SCANNING LIVE',
                    style: TextStyle(
                      color: PrototypeColors.blue,
                      fontSize: 11,
                      fontWeight: FontWeight.w800,
                    ),
                  ),
                  Text(
                    '5 / 30 detected',
                    style: TextStyle(
                      color: PrototypeColors.muted,
                      fontSize: 11,
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _FaceBadge extends StatelessWidget {
  const _FaceBadge({required this.name, required this.score});

  final String name;
  final String score;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: 82,
      padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 7),
      decoration: BoxDecoration(
        color: Colors.white.withValues(alpha: 0.96),
        borderRadius: BorderRadius.circular(14),
        border: Border.all(
          color: PrototypeColors.green.withValues(alpha: 0.45),
          width: 1.5,
        ),
        boxShadow: const [
          BoxShadow(
            color: Color(0x1A000000),
            blurRadius: 18,
            offset: Offset(0, 6),
          ),
        ],
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Container(
            width: 38,
            height: 38,
            decoration: BoxDecoration(
              borderRadius: BorderRadius.circular(11),
              gradient: const LinearGradient(
                colors: [PrototypeColors.blue, Color(0xFF3B7BFF)],
              ),
            ),
            child: const Icon(Icons.person, color: Colors.white, size: 20),
          ),
          const SizedBox(height: 4),
          Text(
            name,
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
            style: const TextStyle(fontSize: 9, fontWeight: FontWeight.w800),
          ),
          Text(
            score,
            style: const TextStyle(
              color: PrototypeColors.green,
              fontSize: 10,
              fontWeight: FontWeight.w800,
            ),
          ),
        ],
      ),
    );
  }
}
