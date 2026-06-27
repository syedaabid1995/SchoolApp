import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';

import '../utils/network_image_url.dart';

class CachedStaffImage extends StatelessWidget {
  const CachedStaffImage({
    required this.imageUrl,
    this.size = 40,
    this.fallbackIcon = Icons.person,
    super.key,
  });

  final String? imageUrl;
  final double size;
  final IconData fallbackIcon;

  @override
  Widget build(BuildContext context) {
    final url = normalizeNetworkImageUrl(imageUrl);
    if (url == null || url.isEmpty) return _fallback(context);
    return ClipOval(
      child: CachedNetworkImage(
        imageUrl: url,
        width: size,
        height: size,
        fit: BoxFit.cover,
        placeholder: (context, url) => _fallback(context),
        errorWidget: (context, url, error) => _fallback(context),
      ),
    );
  }

  Widget _fallback(BuildContext context) {
    return CircleAvatar(
      radius: size / 2,
      child: Icon(fallbackIcon, size: size * .55),
    );
  }
}
