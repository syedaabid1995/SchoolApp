import 'package:file_picker/file_picker.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:image_picker/image_picker.dart';
import 'package:intl/intl.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../../../../global_ui/features/classes/domain/entities/class_assignment.dart';
import '../../../../../global_ui/features/classes/presentation/providers/class_assignment_providers.dart';
import '../../../../../global_ui/features/homework/domain/entities/homework.dart';
import '../../../../../global_ui/features/homework/presentation/providers/homework_providers.dart';
import '../../../../app/theme/saapt_theme.dart';

class SaaptHomeworkScreen extends ConsumerStatefulWidget {
  const SaaptHomeworkScreen({super.key});

  @override
  ConsumerState<SaaptHomeworkScreen> createState() =>
      _SaaptHomeworkScreenState();
}

class _SaaptHomeworkScreenState extends ConsumerState<SaaptHomeworkScreen> {
  DateTime _date = DateTime.now();
  String? _classId;
  String? _sectionId;
  String? _subjectId;

  @override
  Widget build(BuildContext context) {
    final assignmentsState = ref.watch(classAssignmentsProvider);
    return Scaffold(
      body: RefreshIndicator(
        color: SaaptTheme.primary,
        onRefresh: () async {
          ref.invalidate(classAssignmentsProvider);
          ref.invalidate(homeworkListProvider);
        },
        child: CustomScrollView(
          slivers: [
            const SliverToBoxAdapter(child: _Header()),
            SliverPadding(
              padding: const EdgeInsets.fromLTRB(20, 20, 20, 28),
              sliver: SliverToBoxAdapter(
                child: assignmentsState.when(
                  loading: () => const _LoadingPanel(),
                  error: (error, _) => _MessageCard(message: error.toString()),
                  data: (assignments) {
                    _applyDefaults(assignments);
                    final filter = HomeworkFilter(
                      classId: _classId,
                      sectionId: _sectionId,
                      subjectId: _subjectId,
                      homeworkDate: _date,
                    );
                    final homeworkState = ref.watch(
                      homeworkListProvider(filter),
                    );
                    return Column(
                      crossAxisAlignment: CrossAxisAlignment.stretch,
                      children: [
                        _CriteriaCard(
                          assignments: assignments,
                          date: _date,
                          classId: _classId,
                          sectionId: _sectionId,
                          subjectId: _subjectId,
                          onDateChanged: (value) =>
                              setState(() => _date = value),
                          onClassChanged: (value) => setState(() {
                            _classId = value;
                            _sectionId = null;
                            _subjectId = null;
                            _applyDefaults(assignments);
                          }),
                          onSectionChanged: (value) => setState(() {
                            _sectionId = value;
                            _subjectId = null;
                            _applyDefaults(assignments);
                          }),
                          onSubjectChanged: (value) =>
                              setState(() => _subjectId = value),
                          onCreate: () => _openHomeworkForm(assignments),
                        ),
                        const SizedBox(height: 16),
                        homeworkState.when(
                          loading: () => const _LoadingPanel(),
                          error: (error, _) =>
                              _MessageCard(message: error.toString()),
                          data: (items) => _HomeworkList(
                            items: items,
                            onEdit: (homework) => _openHomeworkForm(
                              assignments,
                              homework: homework,
                            ),
                            onEvaluate: _openEvaluation,
                            onHistory: _openNotificationHistory,
                          ),
                        ),
                      ],
                    );
                  },
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  void _applyDefaults(ClassAssignments assignments) {
    if (!assignments.classes.any((item) => item.id == _classId)) {
      _classId = assignments.classes.firstOrNull?.id;
      _sectionId = null;
      _subjectId = null;
    }
    final sections = assignments.sectionsForClass(_classId);
    if (!sections.any((item) => item.id == _sectionId)) {
      _sectionId = sections.firstOrNull?.id;
      _subjectId = null;
    }
    final subjects = assignments.subjectsForClass(
      _classId,
      sectionId: _sectionId,
    );
    if (!subjects.any((item) => item.id == _subjectId)) {
      _subjectId = subjects.firstOrNull?.id;
    }
  }

  Future<void> _openHomeworkForm(
    ClassAssignments assignments, {
    Homework? homework,
  }) async {
    final saved = await showModalBottomSheet<bool>(
      context: context,
      isScrollControlled: true,
      useSafeArea: true,
      builder: (_) => _HomeworkFormSheet(
        assignments: assignments,
        homework: homework,
        initialClassId: _classId,
        initialSectionId: _sectionId,
        initialSubjectId: _subjectId,
      ),
    );
    if (saved == true) ref.invalidate(homeworkListProvider);
  }

  Future<void> _openEvaluation(Homework homework) async {
    final saved = await showModalBottomSheet<bool>(
      context: context,
      isScrollControlled: true,
      useSafeArea: true,
      builder: (_) => _EvaluationSheet(homework: homework),
    );
    if (saved == true) ref.invalidate(homeworkListProvider);
  }

  Future<void> _openNotificationHistory(Homework homework) async {
    await showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      useSafeArea: true,
      builder: (_) => _NotificationHistorySheet(homework: homework),
    );
  }
}

class _Header extends StatelessWidget {
  const _Header();

  @override
  Widget build(BuildContext context) => Container(
    color: SaaptTheme.primary,
    padding: const EdgeInsets.fromLTRB(24, 52, 24, 28),
    child: Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Container(
          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 7),
          decoration: BoxDecoration(
            color: Colors.white.withValues(alpha: 0.14),
            borderRadius: BorderRadius.circular(18),
            border: Border.all(color: Colors.white.withValues(alpha: 0.32)),
          ),
          child: const Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              Icon(Icons.assignment_rounded, size: 19, color: Colors.white),
              SizedBox(width: 7),
              Text(
                'Teacher Homework',
                style: TextStyle(
                  color: Colors.white,
                  fontWeight: FontWeight.w700,
                ),
              ),
            ],
          ),
        ),
        const SizedBox(height: 18),
        const Text(
          'Homework',
          style: TextStyle(
            color: Colors.white,
            fontSize: 32,
            fontWeight: FontWeight.w800,
            height: 1.05,
          ),
        ),
        const SizedBox(height: 8),
        Text(
          'Create, review, and evaluate assigned class homework.',
          style: TextStyle(
            color: Colors.white.withValues(alpha: 0.82),
            fontSize: 16,
            fontWeight: FontWeight.w600,
          ),
        ),
      ],
    ),
  );
}

class _CriteriaCard extends StatelessWidget {
  const _CriteriaCard({
    required this.assignments,
    required this.date,
    required this.classId,
    required this.sectionId,
    required this.subjectId,
    required this.onDateChanged,
    required this.onClassChanged,
    required this.onSectionChanged,
    required this.onSubjectChanged,
    required this.onCreate,
  });

  final ClassAssignments assignments;
  final DateTime date;
  final String? classId;
  final String? sectionId;
  final String? subjectId;
  final ValueChanged<DateTime> onDateChanged;
  final ValueChanged<String?> onClassChanged;
  final ValueChanged<String?> onSectionChanged;
  final ValueChanged<String?> onSubjectChanged;
  final VoidCallback onCreate;

  @override
  Widget build(BuildContext context) {
    final sections = assignments.sectionsForClass(classId);
    final subjects = assignments.subjectsForClass(
      classId,
      sectionId: sectionId,
    );
    return _Card(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Row(
            children: [
              Expanded(
                child: _DatePill(date: date, onChanged: onDateChanged),
              ),
              const SizedBox(width: 10),
              FilledButton.icon(
                style: FilledButton.styleFrom(
                  backgroundColor: SaaptTheme.primary,
                  minimumSize: const Size(0, 48),
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(8),
                  ),
                ),
                onPressed: onCreate,
                icon: const Icon(Icons.add_rounded),
                label: const Text(
                  'Add',
                  style: TextStyle(fontWeight: FontWeight.w800),
                ),
              ),
            ],
          ),
          const SizedBox(height: 14),
          _DropdownField(
            label: 'Class',
            value: classId,
            items: [
              for (final item in assignments.classes)
                DropdownMenuItem(value: item.id, child: Text(item.name)),
            ],
            onChanged: onClassChanged,
          ),
          const SizedBox(height: 10),
          _DropdownField(
            label: 'Section',
            value: sectionId,
            items: [
              for (final item in sections)
                DropdownMenuItem(value: item.id, child: Text(item.name)),
            ],
            onChanged: onSectionChanged,
          ),
          const SizedBox(height: 10),
          _DropdownField(
            label: 'Subject',
            value: subjectId,
            items: [
              for (final item in subjects)
                DropdownMenuItem(value: item.id, child: Text(item.name)),
            ],
            onChanged: onSubjectChanged,
          ),
        ],
      ),
    );
  }
}

class _HomeworkList extends StatelessWidget {
  const _HomeworkList({
    required this.items,
    required this.onEdit,
    required this.onEvaluate,
    required this.onHistory,
  });

  final List<Homework> items;
  final ValueChanged<Homework> onEdit;
  final ValueChanged<Homework> onEvaluate;
  final ValueChanged<Homework> onHistory;

  @override
  Widget build(BuildContext context) {
    if (items.isEmpty) {
      return const _MessageCard(
        message: 'No homework found for the selected date and scope.',
      );
    }
    return Column(
      children: [
        for (final item in items) ...[
          _HomeworkCard(
            homework: item,
            onEdit: () => onEdit(item),
            onEvaluate: () => onEvaluate(item),
            onHistory: () => onHistory(item),
          ),
          const SizedBox(height: 12),
        ],
      ],
    );
  }
}

class _HomeworkCard extends StatelessWidget {
  const _HomeworkCard({
    required this.homework,
    required this.onEdit,
    required this.onEvaluate,
    required this.onHistory,
  });

  final Homework homework;
  final VoidCallback onEdit;
  final VoidCallback onEvaluate;
  final VoidCallback onHistory;

  @override
  Widget build(BuildContext context) {
    final today = DateTime.now();
    final overdue = homework.submissionDate.isBefore(
      DateTime(today.year, today.month, today.day),
    );
    return _Card(
      padding: EdgeInsets.zero,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Padding(
            padding: const EdgeInsets.all(16),
            child: Row(
              children: [
                Container(
                  width: 48,
                  height: 48,
                  decoration: BoxDecoration(
                    color: SaaptTheme.primary.withValues(alpha: 0.10),
                    borderRadius: BorderRadius.circular(12),
                  ),
                  child: const Icon(
                    Icons.menu_book_rounded,
                    color: SaaptTheme.primary,
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        homework.subjectName ?? 'Homework',
                        style: const TextStyle(
                          color: SaaptTheme.navy,
                          fontSize: 17,
                          fontWeight: FontWeight.w900,
                        ),
                      ),
                      const SizedBox(height: 4),
                      Text(
                        '${homework.className ?? ''} ${homework.sectionName ?? ''}'
                            .trim(),
                        style: const TextStyle(
                          color: Color(0xFF667695),
                          fontWeight: FontWeight.w700,
                        ),
                      ),
                    ],
                  ),
                ),
                _StatusBadge(
                  label: overdue ? 'Overdue' : 'Active',
                  color: overdue ? const Color(0xFFE5484D) : SaaptTheme.success,
                ),
              ],
            ),
          ),
          const Divider(height: 1, color: Color(0xFFE4ECF8)),
          Padding(
            padding: const EdgeInsets.all(16),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    Expanded(
                      child: _MetaTile(
                        label: 'Assigned',
                        value: DateFormat.MMMd().format(homework.homeworkDate),
                      ),
                    ),
                    const SizedBox(width: 8),
                    Expanded(
                      child: _MetaTile(
                        label: 'Due',
                        value: DateFormat.MMMd().format(
                          homework.submissionDate,
                        ),
                      ),
                    ),
                    const SizedBox(width: 8),
                    Expanded(
                      child: _MetaTile(
                        label: 'Marks',
                        value: homework.marks.toString(),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 12),
                Text(
                  homework.description,
                  style: const TextStyle(
                    color: Color(0xFF39475F),
                    fontSize: 14,
                    fontWeight: FontWeight.w600,
                    height: 1.45,
                  ),
                ),
                if (homework.attachmentUrl?.trim().isNotEmpty == true) ...[
                  const SizedBox(height: 10),
                  OutlinedButton.icon(
                    onPressed: () => launchUrl(
                      Uri.parse(homework.attachmentUrl!),
                      mode: LaunchMode.externalApplication,
                    ),
                    icon: const Icon(Icons.attach_file_rounded),
                    label: Text(homework.attachmentName ?? 'Open attachment'),
                  ),
                ],
                const SizedBox(height: 12),
                Row(
                  children: [
                    Expanded(
                      child: OutlinedButton.icon(
                        onPressed: onEdit,
                        icon: const Icon(Icons.edit_rounded),
                        label: const Text('Edit'),
                      ),
                    ),
                    const SizedBox(width: 10),
                    Expanded(
                      child: FilledButton.icon(
                        style: FilledButton.styleFrom(
                          backgroundColor: SaaptTheme.primary,
                        ),
                        onPressed: onEvaluate,
                        icon: const Icon(Icons.fact_check_rounded),
                        label: const Text('Evaluate'),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 10),
                OutlinedButton.icon(
                  onPressed: onHistory,
                  icon: const Icon(Icons.visibility_rounded),
                  label: const Text('Notification history'),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _HomeworkFormSheet extends ConsumerStatefulWidget {
  const _HomeworkFormSheet({
    required this.assignments,
    required this.initialClassId,
    required this.initialSectionId,
    required this.initialSubjectId,
    this.homework,
  });

  final ClassAssignments assignments;
  final String? initialClassId;
  final String? initialSectionId;
  final String? initialSubjectId;
  final Homework? homework;

  @override
  ConsumerState<_HomeworkFormSheet> createState() => _HomeworkFormSheetState();
}

class _HomeworkFormSheetState extends ConsumerState<_HomeworkFormSheet> {
  final _descriptionController = TextEditingController();
  String? _classId;
  String? _sectionId;
  String? _subjectId;
  DateTime _homeworkDate = DateTime.now();
  DateTime _submissionDate = DateTime.now().add(const Duration(days: 7));
  String _marks = '10';
  String? _attachmentUrl;
  String? _attachmentName;
  _PickedAttachment? _pickedAttachment;
  bool _saving = false;

  @override
  void initState() {
    super.initState();
    final homework = widget.homework;
    _classId = homework?.classId ?? widget.initialClassId;
    _sectionId = homework?.sectionId ?? widget.initialSectionId;
    _subjectId = homework?.subjectId ?? widget.initialSubjectId;
    if (homework != null) {
      _homeworkDate = homework.homeworkDate;
      _submissionDate = homework.submissionDate;
      _marks = homework.marks.toString();
      _descriptionController.text = homework.description;
      _attachmentUrl = homework.attachmentUrl;
      _attachmentName = homework.attachmentName;
    }
    _applyDefaults();
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
    return Padding(
      padding: EdgeInsets.only(
        left: 20,
        right: 20,
        top: 18,
        bottom: MediaQuery.of(context).viewInsets.bottom + 20,
      ),
      child: SingleChildScrollView(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            _SheetHandle(),
            const SizedBox(height: 14),
            Text(
              widget.homework == null ? 'Add Homework' : 'Edit Homework',
              style: const TextStyle(
                color: SaaptTheme.navy,
                fontSize: 22,
                fontWeight: FontWeight.w900,
              ),
            ),
            const SizedBox(height: 16),
            _DropdownField(
              label: 'Class',
              value: _classId,
              items: [
                for (final item in widget.assignments.classes)
                  DropdownMenuItem(value: item.id, child: Text(item.name)),
              ],
              onChanged: (value) => setState(() {
                _classId = value;
                _sectionId = null;
                _subjectId = null;
                _applyDefaults();
              }),
            ),
            const SizedBox(height: 10),
            _DropdownField(
              label: 'Section',
              value: _sectionId,
              items: [
                for (final item in sections)
                  DropdownMenuItem(value: item.id, child: Text(item.name)),
              ],
              onChanged: (value) => setState(() {
                _sectionId = value;
                _subjectId = null;
                _applyDefaults();
              }),
            ),
            const SizedBox(height: 10),
            _DropdownField(
              label: 'Subject',
              value: _subjectId,
              items: [
                for (final item in subjects)
                  DropdownMenuItem(value: item.id, child: Text(item.name)),
              ],
              onChanged: (value) => setState(() => _subjectId = value),
            ),
            const SizedBox(height: 12),
            Row(
              children: [
                Expanded(
                  child: _DateField(
                    label: 'Homework date',
                    date: _homeworkDate,
                    onChanged: (value) => setState(() {
                      _homeworkDate = value;
                      if (_submissionDate.isBefore(value)) {
                        _submissionDate = value;
                      }
                    }),
                  ),
                ),
                const SizedBox(width: 10),
                Expanded(
                  child: _DateField(
                    label: 'Submission date',
                    date: _submissionDate,
                    firstDate: _homeworkDate,
                    onChanged: (value) =>
                        setState(() => _submissionDate = value),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 12),
            TextFormField(
              initialValue: _marks,
              keyboardType: TextInputType.number,
              decoration: const InputDecoration(labelText: 'Marks'),
              onChanged: (value) => _marks = value,
            ),
            const SizedBox(height: 12),
            TextField(
              controller: _descriptionController,
              minLines: 3,
              maxLines: 6,
              decoration: const InputDecoration(labelText: 'Description'),
            ),
            const SizedBox(height: 12),
            _AttachmentPicker(
              label: _pickedAttachment?.name ?? _attachmentName,
              onPick: _pickAttachment,
              onClear: () => setState(() {
                _pickedAttachment = null;
                _attachmentUrl = null;
                _attachmentName = null;
              }),
            ),
            const SizedBox(height: 18),
            FilledButton.icon(
              style: FilledButton.styleFrom(
                minimumSize: const Size.fromHeight(54),
                backgroundColor: SaaptTheme.primary,
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(8),
                ),
              ),
              onPressed: _saving ? null : _save,
              icon: _saving
                  ? const SizedBox(
                      width: 18,
                      height: 18,
                      child: CircularProgressIndicator(strokeWidth: 2),
                    )
                  : const Icon(Icons.save_rounded),
              label: Text(widget.homework == null ? 'Save Homework' : 'Update'),
            ),
          ],
        ),
      ),
    );
  }

  void _applyDefaults() {
    if (!widget.assignments.classes.any((item) => item.id == _classId)) {
      _classId = widget.assignments.classes.firstOrNull?.id;
    }
    final sections = widget.assignments.sectionsForClass(_classId);
    if (!sections.any((item) => item.id == _sectionId)) {
      _sectionId = sections.firstOrNull?.id;
    }
    final subjects = widget.assignments.subjectsForClass(
      _classId,
      sectionId: _sectionId,
    );
    if (!subjects.any((item) => item.id == _subjectId)) {
      _subjectId = subjects.firstOrNull?.id;
    }
  }

  Future<void> _pickAttachment() async {
    final source = await showModalBottomSheet<_AttachmentSource>(
      context: context,
      builder: (context) => SafeArea(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            ListTile(
              leading: const Icon(Icons.camera_alt_rounded),
              title: const Text('Camera'),
              onTap: () => Navigator.of(context).pop(_AttachmentSource.camera),
            ),
            ListTile(
              leading: const Icon(Icons.photo_library_rounded),
              title: const Text('Gallery'),
              onTap: () => Navigator.of(context).pop(_AttachmentSource.gallery),
            ),
            ListTile(
              leading: const Icon(Icons.folder_rounded),
              title: const Text('Internal storage'),
              onTap: () => Navigator.of(context).pop(_AttachmentSource.storage),
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
      );
      final file = result?.files.single;
      if (file?.path == null) return;
      setState(
        () => _pickedAttachment = _PickedAttachment(file!.path!, file.name),
      );
      return;
    }
    final image = await ImagePicker().pickImage(
      source: source == _AttachmentSource.camera
          ? ImageSource.camera
          : ImageSource.gallery,
      imageQuality: 85,
    );
    if (image == null) return;
    setState(
      () => _pickedAttachment = _PickedAttachment(image.path, image.name),
    );
  }

  Future<void> _save() async {
    if (_classId == null || _sectionId == null || _subjectId == null) {
      _showError('Select class, section, and subject.');
      return;
    }
    if (_descriptionController.text.trim().isEmpty) {
      _showError('Description is required.');
      return;
    }
    setState(() => _saving = true);
    try {
      var attachmentUrl = _attachmentUrl;
      var attachmentName = _attachmentName;
      final picked = _pickedAttachment;
      if (picked != null) {
        final uploaded = await ref
            .read(homeworkMutationProvider.notifier)
            .uploadAttachment(path: picked.path, filename: picked.name);
        attachmentUrl = uploaded.url;
        attachmentName = uploaded.filename;
      }
      final draft = HomeworkDraft(
        classId: _classId!,
        sectionId: _sectionId!,
        subjectId: _subjectId!,
        homeworkDate: _homeworkDate,
        submissionDate: _submissionDate,
        marks: num.tryParse(_marks) ?? 0,
        description: _descriptionController.text.trim(),
        attachmentUrl: attachmentUrl,
        attachmentName: attachmentName,
      );
      final id = widget.homework?.id;
      if (id == null) {
        await ref.read(homeworkMutationProvider.notifier).create(draft);
      } else {
        await ref.read(homeworkMutationProvider.notifier).saveUpdate(id, draft);
      }
      if (mounted) Navigator.of(context).pop(true);
    } catch (error) {
      _showError(error.toString());
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  void _showError(String message) {
    ScaffoldMessenger.of(
      context,
    ).showSnackBar(SnackBar(content: Text(message)));
  }
}

class _EvaluationSheet extends ConsumerStatefulWidget {
  const _EvaluationSheet({required this.homework});

  final Homework homework;

  @override
  ConsumerState<_EvaluationSheet> createState() => _EvaluationSheetState();
}

class _EvaluationSheetState extends ConsumerState<_EvaluationSheet> {
  DateTime _evaluationDate = DateTime.now();
  List<_EvalDraft> _rows = const [];
  bool _initialized = false;
  bool _saving = false;

  @override
  Widget build(BuildContext context) {
    final detailState = ref.watch(
      homeworkEvaluationProvider(widget.homework.id),
    );
    return Padding(
      padding: EdgeInsets.only(
        left: 20,
        right: 20,
        top: 18,
        bottom: MediaQuery.of(context).viewInsets.bottom + 20,
      ),
      child: detailState.when(
        loading: () => const _LoadingPanel(),
        error: (error, _) => _MessageCard(message: error.toString()),
        data: (detail) {
          if (!_initialized) {
            _evaluationDate = detail.homework.evaluationDate ?? DateTime.now();
            _rows = [
              for (final row in detail.rows)
                _EvalDraft(
                  studentId: row.student.id,
                  admissionNo: row.student.admissionNo,
                  name: row.student.fullName,
                  marks: row.evaluation?.marks?.toString() ?? '',
                  comments: row.evaluation?.comments ?? '',
                  completionStatus:
                      row.evaluation?.completionStatus ??
                      HomeworkCompletionStatus.completed,
                  qualityStatus:
                      row.evaluation?.qualityStatus ??
                      HomeworkQualityStatus.good,
                ),
            ];
            _initialized = true;
          }
          return SingleChildScrollView(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                _SheetHandle(),
                const SizedBox(height: 14),
                const Text(
                  'Evaluate Homework',
                  style: TextStyle(
                    color: SaaptTheme.navy,
                    fontSize: 22,
                    fontWeight: FontWeight.w900,
                  ),
                ),
                const SizedBox(height: 6),
                Text(
                  widget.homework.subjectName ?? 'Homework',
                  style: const TextStyle(
                    color: Color(0xFF667695),
                    fontWeight: FontWeight.w700,
                  ),
                ),
                const SizedBox(height: 14),
                _DateField(
                  label: 'Evaluation date',
                  date: _evaluationDate,
                  onChanged: (value) => setState(() => _evaluationDate = value),
                ),
                const SizedBox(height: 14),
                if (_rows.isEmpty)
                  const _MessageCard(message: 'No students found.')
                else
                  for (var index = 0; index < _rows.length; index++) ...[
                    _EvaluationStudentCard(
                      row: _rows[index],
                      onChanged: (value) =>
                          setState(() => _rows[index] = value),
                    ),
                    const SizedBox(height: 10),
                  ],
                const SizedBox(height: 8),
                FilledButton.icon(
                  style: FilledButton.styleFrom(
                    minimumSize: const Size.fromHeight(54),
                    backgroundColor: SaaptTheme.primary,
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(8),
                    ),
                  ),
                  onPressed: _saving || _rows.isEmpty ? null : _save,
                  icon: const Icon(Icons.save_rounded),
                  label: const Text('Save Evaluation'),
                ),
              ],
            ),
          );
        },
      ),
    );
  }

  Future<void> _save() async {
    setState(() => _saving = true);
    try {
      await ref
          .read(homeworkMutationProvider.notifier)
          .saveEvaluation(
            id: widget.homework.id,
            evaluationDate: _evaluationDate,
            evaluations: [
              for (final row in _rows)
                HomeworkEvaluationDraftRow(
                  studentId: row.studentId,
                  marks: row.marks.trim().isEmpty
                      ? null
                      : num.tryParse(row.marks),
                  comments: row.comments.trim().isEmpty
                      ? null
                      : row.comments.trim(),
                  qualityStatus: row.qualityStatus,
                  completionStatus: row.completionStatus,
                ),
            ],
          );
      if (mounted) Navigator.of(context).pop(true);
    } catch (error) {
      if (mounted) {
        ScaffoldMessenger.of(
          context,
        ).showSnackBar(SnackBar(content: Text(error.toString())));
      }
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }
}

class _EvaluationStudentCard extends StatelessWidget {
  const _EvaluationStudentCard({required this.row, required this.onChanged});

  final _EvalDraft row;
  final ValueChanged<_EvalDraft> onChanged;

  @override
  Widget build(BuildContext context) {
    return _Card(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            row.name,
            style: const TextStyle(
              color: SaaptTheme.navy,
              fontSize: 16,
              fontWeight: FontWeight.w900,
            ),
          ),
          const SizedBox(height: 3),
          Text(
            row.admissionNo,
            style: const TextStyle(
              color: Color(0xFF667695),
              fontWeight: FontWeight.w700,
            ),
          ),
          const SizedBox(height: 10),
          Row(
            children: [
              Expanded(
                child: TextFormField(
                  initialValue: row.marks,
                  keyboardType: TextInputType.number,
                  decoration: const InputDecoration(labelText: 'Marks'),
                  onChanged: (value) => onChanged(row.copyWith(marks: value)),
                ),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: DropdownButtonFormField<HomeworkCompletionStatus>(
                  initialValue: row.completionStatus,
                  decoration: const InputDecoration(labelText: 'Status'),
                  items: const [
                    DropdownMenuItem(
                      value: HomeworkCompletionStatus.completed,
                      child: Text('Completed'),
                    ),
                    DropdownMenuItem(
                      value: HomeworkCompletionStatus.notCompleted,
                      child: Text('Not completed'),
                    ),
                  ],
                  onChanged: (value) {
                    if (value != null) {
                      onChanged(row.copyWith(completionStatus: value));
                    }
                  },
                ),
              ),
            ],
          ),
          const SizedBox(height: 10),
          DropdownButtonFormField<HomeworkQualityStatus>(
            initialValue: row.qualityStatus,
            decoration: const InputDecoration(labelText: 'Quality'),
            items: const [
              DropdownMenuItem(
                value: HomeworkQualityStatus.good,
                child: Text('Good'),
              ),
              DropdownMenuItem(
                value: HomeworkQualityStatus.notGood,
                child: Text('Not good'),
              ),
            ],
            onChanged: (value) {
              if (value != null) onChanged(row.copyWith(qualityStatus: value));
            },
          ),
          const SizedBox(height: 10),
          TextFormField(
            initialValue: row.comments,
            decoration: const InputDecoration(labelText: 'Comments'),
            onChanged: (value) => onChanged(row.copyWith(comments: value)),
          ),
        ],
      ),
    );
  }
}

class _DropdownField extends StatelessWidget {
  const _DropdownField({
    required this.label,
    required this.value,
    required this.items,
    required this.onChanged,
  });

  final String label;
  final String? value;
  final List<DropdownMenuItem<String>> items;
  final ValueChanged<String?> onChanged;

  @override
  Widget build(BuildContext context) {
    return DropdownButtonFormField<String>(
      initialValue: items.any((item) => item.value == value) ? value : null,
      decoration: InputDecoration(labelText: label),
      items: items,
      onChanged: items.isEmpty ? null : onChanged,
    );
  }
}

class _DatePill extends StatelessWidget {
  const _DatePill({required this.date, required this.onChanged});

  final DateTime date;
  final ValueChanged<DateTime> onChanged;

  @override
  Widget build(BuildContext context) {
    return InkWell(
      borderRadius: BorderRadius.circular(12),
      onTap: () => _pickDate(context),
      child: Container(
        height: 48,
        padding: const EdgeInsets.symmetric(horizontal: 12),
        decoration: BoxDecoration(
          color: const Color(0xFFF7F9FE),
          borderRadius: BorderRadius.circular(12),
          border: Border.all(color: const Color(0xFFD8E2F5)),
        ),
        child: Row(
          children: [
            IconButton(
              tooltip: 'Previous day',
              icon: const Icon(Icons.chevron_left_rounded),
              onPressed: () =>
                  onChanged(date.subtract(const Duration(days: 1))),
            ),
            Expanded(
              child: Text(
                DateFormat.yMMMd().format(date),
                textAlign: TextAlign.center,
                style: const TextStyle(
                  color: SaaptTheme.navy,
                  fontWeight: FontWeight.w900,
                ),
              ),
            ),
            IconButton(
              tooltip: 'Next day',
              icon: const Icon(Icons.chevron_right_rounded),
              onPressed: () => onChanged(date.add(const Duration(days: 1))),
            ),
          ],
        ),
      ),
    );
  }

  Future<void> _pickDate(BuildContext context) async {
    final picked = await showDatePicker(
      context: context,
      initialDate: date,
      firstDate: DateTime.now().subtract(const Duration(days: 365)),
      lastDate: DateTime.now().add(const Duration(days: 365)),
    );
    if (picked != null) onChanged(picked);
  }
}

class _DateField extends StatelessWidget {
  const _DateField({
    required this.label,
    required this.date,
    required this.onChanged,
    this.firstDate,
  });

  final String label;
  final DateTime date;
  final ValueChanged<DateTime> onChanged;
  final DateTime? firstDate;

  @override
  Widget build(BuildContext context) {
    return InkWell(
      borderRadius: BorderRadius.circular(8),
      onTap: () async {
        final picked = await showDatePicker(
          context: context,
          initialDate: date,
          firstDate:
              firstDate ?? DateTime.now().subtract(const Duration(days: 365)),
          lastDate: DateTime.now().add(const Duration(days: 365)),
        );
        if (picked != null) onChanged(picked);
      },
      child: InputDecorator(
        decoration: InputDecoration(labelText: label),
        child: Text(
          DateFormat.yMMMd().format(date),
          style: const TextStyle(fontWeight: FontWeight.w800),
        ),
      ),
    );
  }
}

class _NotificationHistorySheet extends ConsumerWidget {
  const _NotificationHistorySheet({required this.homework});

  final Homework homework;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final state = ref.watch(homeworkNotificationHistoryProvider(homework.id));
    return SizedBox(
      height: MediaQuery.sizeOf(context).height * 0.86,
      child: Padding(
        padding: const EdgeInsets.fromLTRB(20, 12, 20, 20),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            _SheetHandle(),
            const SizedBox(height: 18),
            Row(
              children: [
                Container(
                  width: 44,
                  height: 44,
                  decoration: BoxDecoration(
                    color: SaaptTheme.primary.withValues(alpha: 0.10),
                    borderRadius: BorderRadius.circular(12),
                  ),
                  child: const Icon(
                    Icons.visibility_rounded,
                    color: SaaptTheme.primary,
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const Text(
                        'Notification history',
                        style: TextStyle(
                          color: SaaptTheme.navy,
                          fontSize: 20,
                          fontWeight: FontWeight.w900,
                        ),
                      ),
                      const SizedBox(height: 3),
                      Text(
                        '${homework.subjectName ?? 'Homework'} - ${DateFormat.MMMd().format(homework.homeworkDate)}',
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: const TextStyle(
                          color: Color(0xFF667695),
                          fontWeight: FontWeight.w700,
                        ),
                      ),
                    ],
                  ),
                ),
                IconButton(
                  tooltip: 'Refresh',
                  onPressed: () => ref.invalidate(
                    homeworkNotificationHistoryProvider(homework.id),
                  ),
                  icon: const Icon(Icons.refresh_rounded),
                ),
              ],
            ),
            const SizedBox(height: 16),
            Expanded(
              child: state.when(
                loading: () => const _LoadingPanel(),
                error: (error, _) => _MessageCard(message: error.toString()),
                data: (rows) {
                  if (rows.isEmpty) {
                    return const _MessageCard(
                      message:
                          'No parent notifications found for this homework.',
                    );
                  }
                  final sentCount = rows.where((row) => row.isSent).length;
                  final viewedCount = rows.where((row) => row.isViewed).length;
                  final failedCount = rows
                      .where((row) => row.notificationStatus == 'FAILED')
                      .length;

                  return Column(
                    children: [
                      Row(
                        children: [
                          Expanded(
                            child: _HistorySummaryTile(
                              label: 'Sent',
                              value: '$sentCount/${rows.length}',
                              color: SaaptTheme.success,
                            ),
                          ),
                          const SizedBox(width: 8),
                          Expanded(
                            child: _HistorySummaryTile(
                              label: 'Viewed',
                              value: '$viewedCount',
                              color: SaaptTheme.primary,
                            ),
                          ),
                          const SizedBox(width: 8),
                          Expanded(
                            child: _HistorySummaryTile(
                              label: 'Failed',
                              value: '$failedCount',
                              color: const Color(0xFFE5484D),
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: 12),
                      Expanded(
                        child: ListView.separated(
                          itemCount: rows.length,
                          separatorBuilder: (_, _) =>
                              const SizedBox(height: 10),
                          itemBuilder: (context, index) =>
                              _NotificationHistoryRowTile(row: rows[index]),
                        ),
                      ),
                    ],
                  );
                },
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _HistorySummaryTile extends StatelessWidget {
  const _HistorySummaryTile({
    required this.label,
    required this.value,
    required this.color,
  });

  final String label;
  final String value;
  final Color color;

  @override
  Widget build(BuildContext context) => Container(
    padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 12),
    decoration: BoxDecoration(
      color: color.withValues(alpha: 0.10),
      borderRadius: BorderRadius.circular(12),
      border: Border.all(color: color.withValues(alpha: 0.16)),
    ),
    child: Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          label,
          style: TextStyle(
            color: color,
            fontSize: 11,
            fontWeight: FontWeight.w900,
          ),
        ),
        const SizedBox(height: 4),
        Text(
          value,
          style: const TextStyle(
            color: SaaptTheme.navy,
            fontSize: 18,
            fontWeight: FontWeight.w900,
          ),
        ),
      ],
    ),
  );
}

class _NotificationHistoryRowTile extends StatelessWidget {
  const _NotificationHistoryRowTile({required this.row});

  final HomeworkNotificationHistoryRow row;

  @override
  Widget build(BuildContext context) {
    final statusColor = _notificationStatusColor(row.notificationStatus);
    return _Card(
      padding: const EdgeInsets.all(14),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      row.parentName,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: const TextStyle(
                        color: SaaptTheme.navy,
                        fontSize: 15,
                        fontWeight: FontWeight.w900,
                      ),
                    ),
                    const SizedBox(height: 3),
                    Text(
                      '${row.studentName}${row.admissionNo == null ? '' : ' - ${row.admissionNo}'}',
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: const TextStyle(
                        color: Color(0xFF667695),
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(width: 8),
              _StatusBadge(
                label: _statusLabel(row.notificationStatus),
                color: statusColor,
              ),
            ],
          ),
          const SizedBox(height: 10),
          Wrap(
            spacing: 8,
            runSpacing: 8,
            children: [
              _HistoryChip(
                icon: row.isViewed
                    ? Icons.done_all_rounded
                    : Icons.visibility_off_rounded,
                label: row.isViewed ? 'Viewed' : 'Not viewed',
                color: row.isViewed
                    ? SaaptTheme.success
                    : const Color(0xFF8A97AD),
              ),
              if (row.sentAt != null)
                _HistoryChip(
                  icon: Icons.notifications_active_rounded,
                  label: _formatHistoryTime(row.sentAt),
                  color: SaaptTheme.primary,
                ),
              if (row.viewedAt != null)
                _HistoryChip(
                  icon: Icons.schedule_rounded,
                  label: _formatHistoryTime(row.viewedAt),
                  color: SaaptTheme.success,
                ),
            ],
          ),
          if (row.notificationError?.trim().isNotEmpty == true) ...[
            const SizedBox(height: 10),
            Text(
              row.notificationError!,
              style: const TextStyle(
                color: Color(0xFFE5484D),
                fontSize: 12,
                fontWeight: FontWeight.w700,
              ),
            ),
          ],
        ],
      ),
    );
  }
}

class _HistoryChip extends StatelessWidget {
  const _HistoryChip({
    required this.icon,
    required this.label,
    required this.color,
  });

  final IconData icon;
  final String label;
  final Color color;

  @override
  Widget build(BuildContext context) => Container(
    padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 7),
    decoration: BoxDecoration(
      color: color.withValues(alpha: 0.10),
      borderRadius: BorderRadius.circular(18),
    ),
    child: Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        Icon(icon, size: 15, color: color),
        const SizedBox(width: 5),
        Text(
          label,
          style: TextStyle(
            color: color,
            fontSize: 11,
            fontWeight: FontWeight.w900,
          ),
        ),
      ],
    ),
  );
}

Color _notificationStatusColor(String status) {
  switch (status) {
    case 'SENT':
      return SaaptTheme.success;
    case 'FAILED':
      return const Color(0xFFE5484D);
    case 'QUEUED':
      return const Color(0xFFE6A700);
    default:
      return const Color(0xFF8A97AD);
  }
}

String _statusLabel(String status) {
  switch (status) {
    case 'SENT':
      return 'Sent';
    case 'FAILED':
      return 'Failed';
    case 'QUEUED':
      return 'Queued';
    default:
      return 'Not sent';
  }
}

String _formatHistoryTime(DateTime? value) {
  if (value == null) return '';
  return DateFormat.MMMd().add_jm().format(value.toLocal());
}

class _AttachmentPicker extends StatelessWidget {
  const _AttachmentPicker({
    required this.label,
    required this.onPick,
    required this.onClear,
  });

  final String? label;
  final VoidCallback onPick;
  final VoidCallback onClear;

  @override
  Widget build(BuildContext context) {
    return _Card(
      child: Row(
        children: [
          const Icon(Icons.attach_file_rounded, color: SaaptTheme.primary),
          const SizedBox(width: 10),
          Expanded(
            child: Text(
              label ?? 'No file attached',
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: const TextStyle(fontWeight: FontWeight.w800),
            ),
          ),
          IconButton(
            tooltip: 'Choose file',
            icon: const Icon(Icons.upload_file_rounded),
            onPressed: onPick,
          ),
          if (label != null)
            IconButton(
              tooltip: 'Clear file',
              icon: const Icon(Icons.close_rounded),
              onPressed: onClear,
            ),
        ],
      ),
    );
  }
}

class _MetaTile extends StatelessWidget {
  const _MetaTile({required this.label, required this.value});

  final String label;
  final String value;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
      decoration: BoxDecoration(
        color: const Color(0xFFF7F9FE),
        borderRadius: BorderRadius.circular(10),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            label,
            style: const TextStyle(
              color: Color(0xFF7A89A3),
              fontSize: 11,
              fontWeight: FontWeight.w800,
            ),
          ),
          const SizedBox(height: 3),
          Text(
            value,
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
            style: const TextStyle(
              color: SaaptTheme.navy,
              fontWeight: FontWeight.w900,
            ),
          ),
        ],
      ),
    );
  }
}

class _StatusBadge extends StatelessWidget {
  const _StatusBadge({required this.label, required this.color});

  final String label;
  final Color color;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 7),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.12),
        borderRadius: BorderRadius.circular(18),
      ),
      child: Text(
        label,
        style: TextStyle(
          color: color,
          fontSize: 11,
          fontWeight: FontWeight.w900,
        ),
      ),
    );
  }
}

class _Card extends StatelessWidget {
  const _Card({required this.child, this.padding});

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

class _MessageCard extends StatelessWidget {
  const _MessageCard({required this.message});

  final String message;

  @override
  Widget build(BuildContext context) {
    return _Card(
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

class _LoadingPanel extends StatelessWidget {
  const _LoadingPanel();

  @override
  Widget build(BuildContext context) => const Padding(
    padding: EdgeInsets.all(48),
    child: Center(child: CircularProgressIndicator()),
  );
}

class _SheetHandle extends StatelessWidget {
  @override
  Widget build(BuildContext context) => Center(
    child: Container(
      width: 46,
      height: 5,
      decoration: BoxDecoration(
        color: const Color(0xFFD7DFEF),
        borderRadius: BorderRadius.circular(10),
      ),
    ),
  );
}

class _PickedAttachment {
  const _PickedAttachment(this.path, this.name);

  final String path;
  final String name;
}

enum _AttachmentSource { camera, gallery, storage }

class _EvalDraft {
  const _EvalDraft({
    required this.studentId,
    required this.admissionNo,
    required this.name,
    required this.marks,
    required this.comments,
    required this.completionStatus,
    required this.qualityStatus,
  });

  final String studentId;
  final String admissionNo;
  final String name;
  final String marks;
  final String comments;
  final HomeworkCompletionStatus completionStatus;
  final HomeworkQualityStatus qualityStatus;

  _EvalDraft copyWith({
    String? marks,
    String? comments,
    HomeworkCompletionStatus? completionStatus,
    HomeworkQualityStatus? qualityStatus,
  }) {
    return _EvalDraft(
      studentId: studentId,
      admissionNo: admissionNo,
      name: name,
      marks: marks ?? this.marks,
      comments: comments ?? this.comments,
      completionStatus: completionStatus ?? this.completionStatus,
      qualityStatus: qualityStatus ?? this.qualityStatus,
    );
  }
}
