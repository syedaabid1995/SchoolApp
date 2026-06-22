String? normalizeNetworkImageUrl(String? rawUrl) {
  final value = rawUrl?.trim();
  if (value == null || value.isEmpty) return null;

  final uri = Uri.tryParse(value);
  if (uri == null || !uri.hasScheme || !uri.hasAuthority) return null;
  if (uri.scheme != 'http' && uri.scheme != 'https') return null;

  final path = uri.path.toLowerCase();
  final looksLikeImage =
      path.endsWith('.jpg') ||
      path.endsWith('.jpeg') ||
      path.endsWith('.png') ||
      path.endsWith('.webp') ||
      path.endsWith('.gif') ||
      path.contains('/uploads/') ||
      path.contains('/images/') ||
      path.contains('/media/') ||
      path.contains('/avatars/');

  if (!looksLikeImage) return null;

  final host = uri.host.toLowerCase();
  if (host == 'localhost' ||
      host == '127.0.0.1' ||
      host.endsWith('.localhost')) {
    return uri.replace(host: '10.0.2.2').toString();
  }

  return uri.toString();
}
