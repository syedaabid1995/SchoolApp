const audienceLabels = (audience: unknown) =>
  Array.isArray(audience)
    ? audience
        .map((item) => item?.toString().trim().toLowerCase() ?? '')
        .filter(Boolean)
    : [];

export const noticeAudienceMatchesRole = (
  audience: unknown,
  role: string | null | undefined,
) => {
  const labels = audienceLabels(audience);
  if (!labels.length) return true;
  if (labels.some((item) => item === 'all' || item.includes('everyone'))) {
    return true;
  }

  const normalizedRole = (role ?? '').trim().toLowerCase();
  if (normalizedRole === 'parent' || normalizedRole === 'guardian') {
    return labels.some(
      (item) =>
        item.includes('parent') ||
        item.includes('guardian') ||
        item.includes('student'),
    );
  }
  if (normalizedRole === 'student') {
    return labels.some((item) => item.includes('student'));
  }
  if (normalizedRole === 'teacher') {
    return labels.some((item) => item.includes('teacher'));
  }
  if (normalizedRole === 'accountant') {
    return labels.some(
      (item) => item.includes('accountant') || item.includes('staff'),
    );
  }
  if (normalizedRole === 'librarian') {
    return labels.some(
      (item) => item.includes('librarian') || item.includes('staff'),
    );
  }
  if (normalizedRole === 'school_admin') {
    return labels.some((item) => item.includes('admin'));
  }
  if (normalizedRole === 'staff') {
    return labels.some((item) => item.includes('staff'));
  }

  return labels.some((item) => normalizedRole && item.includes(normalizedRole));
};
