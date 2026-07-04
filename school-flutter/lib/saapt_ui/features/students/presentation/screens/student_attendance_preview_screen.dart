import 'dart:io';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:image_picker/image_picker.dart';

import '../../../../../global_ui/core/errors/app_error_mapper.dart';
import '../../../../../global_ui/features/attendance/domain/entities/attendance_summary.dart';
import '../../../../../global_ui/features/attendance/presentation/providers/attendance_providers.dart';
import '../../../../app/theme/saapt_theme.dart';

const _statuses = ['PRESENT', 'ABSENT', 'LATE', 'EXCUSED'];

class StudentAttendancePreviewScreen extends ConsumerStatefulWidget {
  const StudentAttendancePreviewScreen({
    required this.query,
    required this.initialSheet,
    required this.initialCaptures,
    super.key,
  });

  final AttendanceSheetQuery query;
  final AttendanceSheet initialSheet;
  final List<XFile> initialCaptures;

  @override
  ConsumerState<StudentAttendancePreviewScreen> createState() =>
      _StudentAttendancePreviewScreenState();
}

class _StudentAttendancePreviewScreenState
    extends ConsumerState<StudentAttendancePreviewScreen> {
  final _picker = ImagePicker();
  late List<XFile> _captures;
  late List<AttendanceStudentRecord> _rows;
  Map<String, AiAttendanceRecord> _aiByStudent = const {};
  bool _recognitionDirty = true;

  @override
  void initState() {
    super.initState();
    _captures = [...widget.initialCaptures];
    _rows = [...widget.initialSheet.rows];
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (mounted && _captures.isNotEmpty) _runRecognition();
    });
  }

  @override
  Widget build(BuildContext context) {
    final saveState = ref.watch(saveAttendanceProvider);
    final recognitionState = ref.watch(recognizeAiAttendanceProvider);
    final present = _rows.where((row) => row.status == 'PRESENT').length;
    final absent = _rows.where((row) => row.status == 'ABSENT').length;
    final needsReview = _aiByStudent.values
        .where((record) => record.needsReview)
        .length;
    return Scaffold(
      appBar: AppBar(title: const Text('Attendance Preview')),
      body: Column(
        children: [
          Container(
            color: const Color(0xFFEDF3FF),
            padding: const EdgeInsets.all(14),
            child: Row(
              children: [
                Expanded(
                  child: _Summary(
                    label: 'Students',
                    value: '${_rows.length}',
                    color: SaaptTheme.primary,
                  ),
                ),
                Expanded(
                  child: _Summary(
                    label: 'Present',
                    value: '$present',
                    color: SaaptTheme.success,
                  ),
                ),
                Expanded(
                  child: _Summary(
                    label: 'Absent',
                    value: '$absent',
                    color: const Color(0xFFD64545),
                  ),
                ),
                Expanded(
                  child: _Summary(
                    label: 'Review',
                    value: '$needsReview',
                    color: SaaptTheme.warning,
                  ),
                ),
              ],
            ),
          ),
          SizedBox(
            height: 92,
            child: ListView.separated(
              padding: const EdgeInsets.all(10),
              scrollDirection: Axis.horizontal,
              itemCount: _captures.length + 1,
              separatorBuilder: (_, _) => const SizedBox(width: 8),
              itemBuilder: (_, index) {
                if (index == _captures.length) {
                  return _AddImageButton(onPressed: _chooseImageSource);
                }
                return ClipRRect(
                  borderRadius: BorderRadius.circular(8),
                  child: Image.file(
                    File(_captures[index].path),
                    width: 72,
                    height: 72,
                    fit: BoxFit.cover,
                  ),
                );
              },
            ),
          ),
          _RecognitionBar(
            state: recognitionState,
            dirty: _recognitionDirty,
            imageCount: _captures.length,
            onAnalyze: recognitionState.isLoading ? null : _runRecognition,
          ),
          Expanded(
            child: ListView.separated(
              padding: const EdgeInsets.fromLTRB(16, 8, 16, 100),
              itemCount: _rows.length,
              separatorBuilder: (_, _) => const SizedBox(height: 8),
              itemBuilder: (context, index) {
                final row = _rows[index];
                final aiRecord = _aiByStudent[row.studentId];
                return Container(
                  padding: const EdgeInsets.fromLTRB(14, 10, 10, 10),
                  decoration: BoxDecoration(
                    color: Colors.white,
                    borderRadius: BorderRadius.circular(8),
                    border: Border.all(color: const Color(0xFFDDE5F2)),
                  ),
                  child: Row(
                    children: [
                      CircleAvatar(
                        backgroundColor: const Color(0xFFE8EFFF),
                        child: Text(
                          row.fullName.isEmpty
                              ? '?'
                              : row.fullName[0].toUpperCase(),
                          style: const TextStyle(
                            color: SaaptTheme.primary,
                            fontWeight: FontWeight.w800,
                          ),
                        ),
                      ),
                      const SizedBox(width: 12),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              row.fullName,
                              style: const TextStyle(
                                fontWeight: FontWeight.w700,
                              ),
                            ),
                            if (row.rollNo != null)
                              Text(
                                'Roll ${row.rollNo}',
                                style: const TextStyle(
                                  color: Color(0xFF8A9AB8),
                                  fontSize: 12,
                                ),
                              ),
                            if (aiRecord != null) ...[
                              const SizedBox(height: 5),
                              _AiStatusBadge(record: aiRecord),
                            ],
                          ],
                        ),
                      ),
                      DropdownButton<String>(
                        value: _statuses.contains(row.status)
                            ? row.status
                            : 'PRESENT',
                        underline: const SizedBox.shrink(),
                        items: [
                          for (final status in _statuses)
                            DropdownMenuItem(
                              value: status,
                              child: Text(
                                _label(status),
                                style: TextStyle(
                                  fontSize: 12,
                                  fontWeight: FontWeight.w700,
                                  color: _statusColor(status),
                                ),
                              ),
                            ),
                        ],
                        onChanged: widget.initialSheet.isLocked
                            ? null
                            : (status) => setState(
                                () => _rows[index] = row.copyWith(
                                  status: status,
                                  clearConfidence: true,
                                  manualOverrideReason: aiRecord == null
                                      ? row.manualOverrideReason
                                      : 'Manual correction after AI attendance',
                                ),
                              ),
                      ),
                    ],
                  ),
                );
              },
            ),
          ),
        ],
      ),
      bottomSheet: SafeArea(
        child: Container(
          color: Colors.white,
          padding: const EdgeInsets.all(14),
          child: FilledButton.icon(
            style: FilledButton.styleFrom(
              minimumSize: const Size.fromHeight(54),
              backgroundColor: SaaptTheme.success,
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(8),
              ),
            ),
            onPressed:
                saveState.isLoading ||
                    widget.initialSheet.isLocked ||
                    recognitionState.isLoading ||
                    _recognitionDirty
                ? null
                : _save,
            icon: saveState.isLoading
                ? const SizedBox.square(
                    dimension: 18,
                    child: CircularProgressIndicator(
                      strokeWidth: 2,
                      color: Colors.white,
                    ),
                  )
                : const Icon(Icons.check_circle_outline),
            label: Text(
              widget.initialSheet.isLocked
                  ? 'Attendance Locked'
                  : 'Submit Attendance',
              style: const TextStyle(fontWeight: FontWeight.w800),
            ),
          ),
        ),
      ),
    );
  }

  Future<void> _chooseImageSource() async {
    final source = await showModalBottomSheet<_AiAttendanceImageSource>(
      context: context,
      builder: (context) => SafeArea(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            ListTile(
              leading: const Icon(Icons.camera_alt_outlined),
              title: const Text('Camera'),
              onTap: () =>
                  Navigator.of(context).pop(_AiAttendanceImageSource.camera),
            ),
            ListTile(
              leading: const Icon(Icons.folder_open_outlined),
              title: const Text('Internal storage'),
              onTap: () =>
                  Navigator.of(context).pop(_AiAttendanceImageSource.storage),
            ),
          ],
        ),
      ),
    );
    if (source == null) return;
    await _captureAnother(source);
  }

  Future<void> _captureAnother(_AiAttendanceImageSource source) async {
    try {
      final captures = await _pickAiAttendanceImages(source);
      if (captures.isNotEmpty && mounted) {
        setState(() {
          _captures.addAll(captures);
          _recognitionDirty = true;
        });
      }
    } catch (error) {
      if (!mounted) return;
      final label = source == _AiAttendanceImageSource.camera
          ? 'camera'
          : 'internal storage';
      ScaffoldMessenger.of(
        context,
      ).showSnackBar(SnackBar(content: Text('Unable to open $label: $error')));
    }
  }

  Future<List<XFile>> _pickAiAttendanceImages(
    _AiAttendanceImageSource source,
  ) async {
    if (source == _AiAttendanceImageSource.camera) {
      final capture = await _picker.pickImage(
        source: ImageSource.camera,
        imageQuality: 82,
        maxWidth: 2048,
      );
      return capture == null ? const <XFile>[] : [capture];
    }
    return _picker.pickMultiImage(imageQuality: 82, maxWidth: 2048);
  }

  Future<void> _runRecognition() async {
    if (_captures.isEmpty) return;
    final photos = [
      for (var index = 0; index < _captures.length; index += 1)
        AttendancePhotoUpload(
          path: _captures[index].path,
          name: _captures[index].name.isNotEmpty
              ? _captures[index].name
              : 'attendance-${index + 1}.jpg',
        ),
    ];
    await ref
        .read(recognizeAiAttendanceProvider.notifier)
        .recognize(query: widget.query, photos: photos);
    if (!mounted) return;
    final result = ref.read(recognizeAiAttendanceProvider);
    if (result.hasError) {
      ScaffoldMessenger.of(
        context,
      ).showSnackBar(SnackBar(content: Text(result.error.toString())));
      return;
    }
    final recognition = result.value;
    if (recognition == null) return;
    setState(() {
      _applyRecognition(recognition);
      _recognitionDirty = false;
    });
  }

  void _applyRecognition(AiAttendanceRecognition recognition) {
    final byStudent = {
      for (final record in recognition.records) record.studentId: record,
    };
    _aiByStudent = byStudent;
    _rows = [
      for (final row in _rows)
        _applyRecognitionToRow(row, byStudent[row.studentId]),
    ];
  }

  AttendanceStudentRecord _applyRecognitionToRow(
    AttendanceStudentRecord row,
    AiAttendanceRecord? record,
  ) {
    if (record == null) {
      return row.copyWith(status: 'ABSENT', clearConfidence: true);
    }
    if (record.isPresent) {
      return row.copyWith(
        status: 'PRESENT',
        confidence: record.confidence == null ? null : record.confidence! / 100,
        manualOverrideReason: '',
      );
    }
    return row.copyWith(
      status: 'ABSENT',
      clearConfidence: true,
      manualOverrideReason: record.needsReview
          ? 'AI attendance needs review'
          : '',
    );
  }

  Future<void> _save() async {
    await ref
        .read(saveAttendanceProvider.notifier)
        .save(AttendanceSheetSaveRequest(query: widget.query, records: _rows));
    if (!mounted) return;
    final result = ref.read(saveAttendanceProvider);
    if (result.hasError) {
      ScaffoldMessenger.of(
        context,
      ).showSnackBar(SnackBar(content: Text(result.error.toString())));
      return;
    }
    Navigator.of(context).pop();
  }

  String _label(String status) => status[0] + status.substring(1).toLowerCase();

  Color _statusColor(String status) => switch (status) {
    'PRESENT' => SaaptTheme.success,
    'ABSENT' => const Color(0xFFD64545),
    'LATE' => SaaptTheme.warning,
    _ => const Color(0xFF60708F),
  };
}

enum _AiAttendanceImageSource { camera, storage }

class _AddImageButton extends StatelessWidget {
  const _AddImageButton({required this.onPressed});
  final VoidCallback onPressed;

  @override
  Widget build(BuildContext context) => SizedBox(
    width: 72,
    height: 72,
    child: OutlinedButton(
      style: OutlinedButton.styleFrom(
        padding: EdgeInsets.zero,
        side: const BorderSide(color: SaaptTheme.primary, width: 1.4),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
        backgroundColor: const Color(0xFFEAF1FF),
      ),
      onPressed: onPressed,
      child: const Icon(Icons.add_a_photo_outlined, color: SaaptTheme.primary),
    ),
  );
}

class _RecognitionBar extends StatelessWidget {
  const _RecognitionBar({
    required this.state,
    required this.dirty,
    required this.imageCount,
    required this.onAnalyze,
  });

  final AsyncValue<AiAttendanceRecognition?> state;
  final bool dirty;
  final int imageCount;
  final VoidCallback? onAnalyze;

  @override
  Widget build(BuildContext context) {
    final recognition = state.value;
    final error = state.hasError ? state.error : null;
    final errorMessage = error == null
        ? null
        : AppErrorMapper.map(error).message;
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.fromLTRB(16, 8, 16, 10),
      decoration: const BoxDecoration(
        color: Colors.white,
        border: Border(bottom: BorderSide(color: Color(0xFFDDE5F2))),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          if (state.isLoading) ...[
            const LinearProgressIndicator(minHeight: 3),
            const SizedBox(height: 8),
          ],
          Row(
            children: [
              Expanded(
                child: Text(
                  error != null
                      ? errorMessage!
                      : recognition == null
                      ? '$imageCount image${imageCount == 1 ? '' : 's'} ready'
                      : '${recognition.summary.detectedFaces} faces scanned - ${recognition.summary.registeredFaceSamples} samples',
                  style: TextStyle(
                    color: error == null
                        ? const Color(0xFF60708F)
                        : const Color(0xFFD64545),
                    fontSize: 12,
                    fontWeight: FontWeight.w700,
                  ),
                ),
              ),
              const SizedBox(width: 10),
              OutlinedButton.icon(
                onPressed: onAnalyze,
                icon: const Icon(Icons.auto_awesome_outlined, size: 18),
                label: Text(
                  dirty || recognition == null ? 'Analyze' : 'Re-analyze',
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

class _AiStatusBadge extends StatelessWidget {
  const _AiStatusBadge({required this.record});

  final AiAttendanceRecord record;

  @override
  Widget build(BuildContext context) {
    final color = record.isPresent
        ? SaaptTheme.success
        : record.needsReview
        ? SaaptTheme.warning
        : const Color(0xFF8A9AB8);
    final label = record.isPresent
        ? 'AI present'
        : record.needsReview
        ? 'Needs review'
        : 'Not detected';
    final confidence = record.confidence == null
        ? ''
        : ' ${record.confidence!.round()}%';
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.10),
        borderRadius: BorderRadius.circular(8),
        border: Border.all(color: color.withValues(alpha: 0.35)),
      ),
      child: Text(
        '$label$confidence',
        style: TextStyle(
          color: color,
          fontSize: 11,
          fontWeight: FontWeight.w800,
        ),
      ),
    );
  }
}

class _Summary extends StatelessWidget {
  const _Summary({
    required this.label,
    required this.value,
    required this.color,
  });
  final String label;
  final String value;
  final Color color;

  @override
  Widget build(BuildContext context) => Column(
    children: [
      Text(
        value,
        style: TextStyle(
          color: color,
          fontSize: 20,
          fontWeight: FontWeight.w800,
        ),
      ),
      Text(
        label,
        style: const TextStyle(color: Color(0xFF60708F), fontSize: 11),
      ),
    ],
  );
}
