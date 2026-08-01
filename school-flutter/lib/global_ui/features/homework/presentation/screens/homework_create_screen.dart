import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:file_picker/file_picker.dart';
import 'package:image_picker/image_picker.dart';
import 'package:intl/intl.dart';

import '../../../../app/theme/app_spacing.dart';
import '../../../../core/widgets/app_button.dart';
import '../../../../core/widgets/app_scaffold.dart';
import '../../../classes/domain/entities/class_assignment.dart';
import '../../domain/entities/homework.dart';
import '../providers/homework_providers.dart';

class HomeworkCreateScreen extends ConsumerStatefulWidget {
  const HomeworkCreateScreen({
    required this.assignments,
    this.homework,
    super.key,
  });

  final ClassAssignments assignments;
  final Homework? homework;

  @override
  ConsumerState<HomeworkCreateScreen> createState() =>
      _HomeworkCreateScreenState();
}

class _HomeworkCreateScreenState extends ConsumerState<HomeworkCreateScreen> {
  final _descriptionController = TextEditingController();
  String? _classId;
  String? _sectionId;
  String? _subjectId;
  String? _attachmentUrl;
  String? _attachmentName;
  _AttachmentPick? _pickedAttachment;
  DateTime _homeworkDate = DateTime.now();
  DateTime _submissionDate = DateTime.now().add(const Duration(days: 7));
  num _marks = 10;

  bool get _isEditing => widget.homework != null;

  @override
  void initState() {
    super.initState();
    final item = widget.homework;
    if (item != null) {
      _classId = item.classId;
      _sectionId = item.sectionId;
      _subjectId = item.subjectId;
      _homeworkDate = item.homeworkDate;
      _submissionDate = item.submissionDate;
      _marks = item.marks;
      _descriptionController.text = item.description;
      _attachmentUrl = item.attachmentUrl;
      _attachmentName = item.attachmentName;
    }
  }

  @override
  void dispose() {
    _descriptionController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final sections = widget.assignments.sectionsForClass(_classId);
    final subjects = widget.assignments.subjectsForClass(
      _classId,
      sectionId: _sectionId,
    );
    final state = ref.watch(homeworkMutationProvider);
    final colorScheme = Theme.of(context).colorScheme;
    final textTheme = Theme.of(context).textTheme;

    return AppScaffold(
      title: _isEditing ? 'Edit Homework' : 'Create Homework',
      emoji: _isEditing ? '✏️' : '📝',
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          const SizedBox(height: AppSpacing.md),

          // ── Class / Section / Subject ───────────────────────────────
          _SectionLabel(label: 'Class & Subject'),
          const SizedBox(height: AppSpacing.xs),
          _FormCard(
            child: Column(
              children: [
                _StyledDropdown<String>(
                  hint: 'Select class',
                  icon: Icons.class_outlined,
                  value: _classId,
                  items: [
                    for (final item in widget.assignments.classes)
                      DropdownMenuItem(value: item.id, child: Text(item.name)),
                  ],
                  onChanged: (value) => setState(() {
                    _classId = value;
                    _sectionId = null;
                    _subjectId = null;
                  }),
                ),
                if (_classId != null) ...[
                  _CardDivider(),
                  _StyledDropdown<String>(
                    hint: 'Select section',
                    icon: Icons.grid_view_outlined,
                    value: _sectionId,
                    items: [
                      for (final item in sections)
                        DropdownMenuItem(
                          value: item.id,
                          child: Text(item.name),
                        ),
                    ],
                    onChanged: (value) => setState(() {
                      _sectionId = value;
                      _subjectId = null;
                    }),
                  ),
                  if (_sectionId != null) ...[
                    _CardDivider(),
                    _StyledDropdown<String>(
                      hint: 'Select subject',
                      icon: Icons.book_outlined,
                      value: _subjectId,
                      items: [
                        for (final item in subjects)
                          DropdownMenuItem(
                            value: item.id,
                            child: Text(item.name),
                          ),
                      ],
                      onChanged: (value) => setState(() => _subjectId = value),
                    ),
                  ],
                ],
              ],
            ),
          ),

          const SizedBox(height: AppSpacing.md),

          // ── Dates ───────────────────────────────────────────────────
          _SectionLabel(label: 'Dates'),
          const SizedBox(height: AppSpacing.xs),
          Row(
            children: [
              Expanded(
                child: _DateCard(
                  label: 'Assigned',
                  icon: Icons.today_outlined,
                  date: _homeworkDate,
                  onTap: () async {
                    final picked = await showDatePicker(
                      context: context,
                      firstDate: DateTime.now().subtract(
                        const Duration(days: 365),
                      ),
                      lastDate: DateTime.now().add(const Duration(days: 365)),
                      initialDate: _homeworkDate,
                    );
                    if (picked != null) setState(() => _homeworkDate = picked);
                  },
                ),
              ),
              const SizedBox(width: AppSpacing.sm),
              Expanded(
                child: _DateCard(
                  label: 'Due Date',
                  icon: Icons.upload_outlined,
                  date: _submissionDate,
                  onTap: () async {
                    final picked = await showDatePicker(
                      context: context,
                      firstDate: _homeworkDate,
                      lastDate: DateTime.now().add(const Duration(days: 365)),
                      initialDate: _submissionDate,
                    );
                    if (picked != null) {
                      setState(() => _submissionDate = picked);
                    }
                  },
                ),
              ),
            ],
          ),

          const SizedBox(height: AppSpacing.md),

          // ── Marks ───────────────────────────────────────────────────
          _SectionLabel(label: 'Marks'),
          const SizedBox(height: AppSpacing.xs),
          _FormCard(
            child: Row(
              children: [
                Padding(
                  padding: const EdgeInsets.only(
                    left: AppSpacing.md,
                    top: AppSpacing.sm,
                    bottom: AppSpacing.sm,
                  ),
                  child: Icon(Icons.grade_outlined, color: colorScheme.primary),
                ),
                const SizedBox(width: AppSpacing.xs),
                Expanded(
                  child: TextFormField(
                    initialValue: _marks.toString(),
                    keyboardType: TextInputType.number,
                    decoration: const InputDecoration(
                      hintText: 'Total marks',
                      border: InputBorder.none,
                      enabledBorder: InputBorder.none,
                      focusedBorder: InputBorder.none,
                    ),
                    onChanged: (value) =>
                        _marks = num.tryParse(value) ?? _marks,
                  ),
                ),
                Row(
                  children: [
                    IconButton(
                      icon: const Icon(Icons.remove_circle_outline),
                      color: colorScheme.primary,
                      onPressed: () =>
                          setState(() => _marks = (_marks - 1).clamp(1, 999)),
                    ),
                    IconButton(
                      icon: const Icon(Icons.add_circle_outline),
                      color: colorScheme.primary,
                      onPressed: () =>
                          setState(() => _marks = (_marks + 1).clamp(1, 999)),
                    ),
                  ],
                ),
              ],
            ),
          ),

          const SizedBox(height: AppSpacing.md),

          // ── Description ─────────────────────────────────────────────
          _SectionLabel(label: 'Description'),
          const SizedBox(height: AppSpacing.xs),
          _FormCard(
            child: TextField(
              controller: _descriptionController,
              minLines: 3,
              maxLines: 6,
              decoration: InputDecoration(
                hintText: 'Enter homework instructions…',
                border: InputBorder.none,
                enabledBorder: InputBorder.none,
                focusedBorder: InputBorder.none,
                prefixIcon: Padding(
                  padding: const EdgeInsets.only(bottom: AppSpacing.xl),
                  child: Icon(Icons.notes_outlined, color: colorScheme.primary),
                ),
              ),
            ),
          ),

          const SizedBox(height: AppSpacing.md),

          _SectionLabel(label: 'Attachment'),
          const SizedBox(height: AppSpacing.xs),
          _FormCard(
            child: ListTile(
              leading: Icon(
                Icons.attach_file_outlined,
                color: colorScheme.primary,
              ),
              title: Text(
                _pickedAttachment?.name ??
                    _attachmentName ??
                    'No file attached',
              ),
              subtitle: Text(
                _pickedAttachment == null && _attachmentName != null
                    ? 'Current attachment'
                    : 'Camera, gallery, PDF, or document',
              ),
              trailing: Wrap(
                spacing: AppSpacing.xs,
                children: [
                  IconButton(
                    tooltip: 'Choose attachment',
                    icon: const Icon(Icons.upload_file_outlined),
                    onPressed: () => _chooseAttachment(context),
                  ),
                  if (_pickedAttachment != null || _attachmentUrl != null)
                    IconButton(
                      tooltip: 'Remove attachment',
                      icon: const Icon(Icons.close),
                      onPressed: () => setState(() {
                        _pickedAttachment = null;
                        _attachmentUrl = null;
                        _attachmentName = null;
                      }),
                    ),
                ],
              ),
            ),
          ),

          // ── Error ────────────────────────────────────────────────────
          if (state.hasError) ...[
            const SizedBox(height: AppSpacing.sm),
            Container(
              padding: const EdgeInsets.all(AppSpacing.sm),
              decoration: BoxDecoration(
                color: colorScheme.errorContainer,
                borderRadius: BorderRadius.circular(12),
              ),
              child: Row(
                children: [
                  Icon(
                    Icons.error_outline,
                    size: 16,
                    color: colorScheme.onErrorContainer,
                  ),
                  const SizedBox(width: AppSpacing.xs),
                  Expanded(
                    child: Text(
                      state.error.toString(),
                      style: textTheme.bodySmall?.copyWith(
                        color: colorScheme.onErrorContainer,
                      ),
                    ),
                  ),
                ],
              ),
            ),
          ],

          const SizedBox(height: AppSpacing.lg),

          AppButton(
            label: _isEditing ? 'Save Changes' : 'Create Homework',
            icon: _isEditing ? Icons.save_outlined : Icons.add,
            isLoading: state.isLoading,
            onPressed:
                _classId == null || _sectionId == null || _subjectId == null
                ? null
                : () async {
                    var attachmentUrl = _attachmentUrl;
                    var attachmentName = _attachmentName;
                    final pickedAttachment = _pickedAttachment;
                    if (pickedAttachment != null) {
                      try {
                        final uploaded = await ref
                            .read(homeworkMutationProvider.notifier)
                            .uploadAttachment(
                              path: pickedAttachment.path,
                              filename: pickedAttachment.name,
                            );
                        attachmentUrl = uploaded.url;
                        attachmentName = uploaded.filename;
                      } catch (error) {
                        if (context.mounted) {
                          ScaffoldMessenger.of(context).showSnackBar(
                            SnackBar(content: Text(error.toString())),
                          );
                        }
                        return;
                      }
                    }
                    final draft = HomeworkDraft(
                      classId: _classId!,
                      sectionId: _sectionId!,
                      subjectId: _subjectId!,
                      homeworkDate: _homeworkDate,
                      submissionDate: _submissionDate,
                      marks: _marks,
                      description: _descriptionController.text,
                      attachmentUrl: attachmentUrl,
                      attachmentName: attachmentName,
                    );
                    final id = widget.homework?.id;
                    if (id == null) {
                      await ref
                          .read(homeworkMutationProvider.notifier)
                          .create(draft);
                    } else {
                      await ref
                          .read(homeworkMutationProvider.notifier)
                          .saveUpdate(id, draft);
                    }
                    if (!ref.read(homeworkMutationProvider).hasError &&
                        context.mounted) {
                      Navigator.of(context).pop();
                    }
                  },
          ),

          const SizedBox(height: AppSpacing.lg),
        ],
      ),
    );
  }

  Future<void> _chooseAttachment(BuildContext context) async {
    final source = await showModalBottomSheet<_AttachmentSource>(
      context: context,
      builder: (ctx) => SafeArea(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            ListTile(
              leading: const Icon(Icons.camera_alt_outlined),
              title: const Text('Camera'),
              onTap: () => Navigator.of(ctx).pop(_AttachmentSource.camera),
            ),
            ListTile(
              leading: const Icon(Icons.photo_library_outlined),
              title: const Text('Gallery'),
              onTap: () => Navigator.of(ctx).pop(_AttachmentSource.gallery),
            ),
            ListTile(
              leading: const Icon(Icons.folder_outlined),
              title: const Text('Internal storage'),
              onTap: () => Navigator.of(ctx).pop(_AttachmentSource.storage),
            ),
          ],
        ),
      ),
    );
    if (source == null) return;

    if (source == _AttachmentSource.storage) {
      final result = await FilePicker.pickFiles(
        type: FileType.custom,
        allowedExtensions: ['pdf', 'doc', 'docx', 'jpg', 'jpeg', 'png', 'webp'],
        allowMultiple: false,
      );
      final file = result?.files.single;
      if (file?.path == null) return;
      setState(
        () => _pickedAttachment = _AttachmentPick(file!.path!, file.name),
      );
      return;
    }

    final picker = ImagePicker();
    final image = await picker.pickImage(
      source: source == _AttachmentSource.camera
          ? ImageSource.camera
          : ImageSource.gallery,
      imageQuality: 85,
    );
    if (image == null) return;
    setState(() => _pickedAttachment = _AttachmentPick(image.path, image.name));
  }
}

enum _AttachmentSource { camera, gallery, storage }

class _AttachmentPick {
  const _AttachmentPick(this.path, this.name);

  final String path;
  final String name;
}

// ── Shared form widgets ────────────────────────────────────────────────────

class _SectionLabel extends StatelessWidget {
  const _SectionLabel({required this.label});

  final String label;

  @override
  Widget build(BuildContext context) {
    return Text(
      label,
      style: Theme.of(context).textTheme.labelLarge?.copyWith(
        color: Theme.of(context).colorScheme.onSurface.withValues(alpha: 0.6),
        fontWeight: FontWeight.w600,
        letterSpacing: 0.5,
      ),
    );
  }
}

class _FormCard extends StatelessWidget {
  const _FormCard({required this.child});

  final Widget child;

  @override
  Widget build(BuildContext context) {
    final colorScheme = Theme.of(context).colorScheme;
    return Container(
      decoration: BoxDecoration(
        color: colorScheme.surface,
        borderRadius: BorderRadius.circular(16),
        boxShadow: [
          BoxShadow(
            color: colorScheme.shadow.withValues(alpha: 0.06),
            blurRadius: 10,
            offset: const Offset(0, 3),
          ),
        ],
      ),
      child: child,
    );
  }
}

class _CardDivider extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    return Divider(
      height: 1,
      indent: AppSpacing.md,
      color: Theme.of(
        context,
      ).colorScheme.outlineVariant.withValues(alpha: 0.4),
    );
  }
}

class _StyledDropdown<T> extends StatelessWidget {
  const _StyledDropdown({
    required this.hint,
    required this.icon,
    required this.value,
    required this.items,
    required this.onChanged,
  });

  final String hint;
  final IconData icon;
  final T? value;
  final List<DropdownMenuItem<T>> items;
  final ValueChanged<T?> onChanged;

  @override
  Widget build(BuildContext context) {
    final colorScheme = Theme.of(context).colorScheme;
    return DropdownButtonFormField<T>(
      initialValue: value,
      decoration: InputDecoration(
        hintText: hint,
        border: InputBorder.none,
        enabledBorder: InputBorder.none,
        focusedBorder: InputBorder.none,
        prefixIcon: Icon(icon, color: colorScheme.primary),
        contentPadding: const EdgeInsets.symmetric(vertical: AppSpacing.sm),
      ),
      items: items,
      onChanged: onChanged,
    );
  }
}

class _DateCard extends StatelessWidget {
  const _DateCard({
    required this.label,
    required this.icon,
    required this.date,
    required this.onTap,
  });

  final String label;
  final IconData icon;
  final DateTime date;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final colorScheme = Theme.of(context).colorScheme;
    final textTheme = Theme.of(context).textTheme;
    return InkWell(
      borderRadius: BorderRadius.circular(16),
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.all(AppSpacing.md),
        decoration: BoxDecoration(
          color: colorScheme.surface,
          borderRadius: BorderRadius.circular(16),
          border: Border.all(color: colorScheme.primary.withValues(alpha: 0.2)),
          boxShadow: [
            BoxShadow(
              color: colorScheme.shadow.withValues(alpha: 0.06),
              blurRadius: 10,
              offset: const Offset(0, 3),
            ),
          ],
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Icon(icon, size: 14, color: colorScheme.primary),
                const SizedBox(width: AppSpacing.xxs),
                Text(
                  label,
                  style: textTheme.labelSmall?.copyWith(
                    color: colorScheme.primary,
                    fontWeight: FontWeight.w700,
                  ),
                ),
              ],
            ),
            const SizedBox(height: AppSpacing.xs),
            Text(
              DateFormat.MMMd().format(date),
              style: textTheme.titleMedium?.copyWith(
                fontWeight: FontWeight.w700,
              ),
            ),
            Text(
              DateFormat.y().format(date),
              style: textTheme.bodySmall?.copyWith(
                color: colorScheme.onSurface.withValues(alpha: 0.5),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
