import 'package:flutter/widgets.dart';

class AppBreakpoints {
  const AppBreakpoints._();

  static const compact = 600.0;
  static const medium = 900.0;
  static const expanded = 1200.0;

  static bool isCompact(BuildContext context) =>
      MediaQuery.sizeOf(context).width < compact;

  static bool isMedium(BuildContext context) {
    final width = MediaQuery.sizeOf(context).width;
    return width >= compact && width < medium;
  }

  static bool isExpanded(BuildContext context) =>
      MediaQuery.sizeOf(context).width >= medium;

  static double contentMaxWidth(BuildContext context) {
    final width = MediaQuery.sizeOf(context).width;
    if (width >= expanded) return 1120;
    if (width >= medium) return 960;
    return double.infinity;
  }

  static int dashboardColumns(BuildContext context) {
    final width = MediaQuery.sizeOf(context).width;
    if (width >= expanded) return 4;
    if (width >= medium) return 3;
    if (width >= compact) return 2;
    return 1;
  }
}
