import 'package:flutter/material.dart';

class AppButton extends StatelessWidget {
  const AppButton({
    required this.label,
    required this.onPressed,
    this.icon,
    this.isLoading = false,
    super.key,
  });

  final String label;
  final VoidCallback? onPressed;
  final IconData? icon;
  final bool isLoading;

  @override
  Widget build(BuildContext context) {
    final semanticsLabel = isLoading ? '$label loading' : label;
    final child = isLoading
        ? const SizedBox.square(
            dimension: 20,
            child: CircularProgressIndicator(strokeWidth: 2),
          )
        : Text(label);
    return Semantics(
      button: true,
      enabled: !isLoading && onPressed != null,
      label: semanticsLabel,
      child: FocusTraversalGroup(
        child: icon != null
            ? FilledButton.icon(
                onPressed: isLoading ? null : onPressed,
                icon: Icon(icon),
                label: child,
              )
            : FilledButton(
                onPressed: isLoading ? null : onPressed,
                child: child,
              ),
      ),
    );
  }
}
