import 'dart:io';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:image_picker/image_picker.dart';

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

  @override
  void initState() {
    super.initState();
    _captures = [...widget.initialCaptures];
    _rows = [...widget.initialSheet.rows];
  }

  @override
  Widget build(BuildContext context) {
    final saveState = ref.watch(saveAttendanceProvider);
    final present = _rows.where((row) => row.status == 'PRESENT').length;
    final absent = _rows.where((row) => row.status == 'ABSENT').length;
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
                    label: 'Images',
                    value: '${_captures.length}',
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
                  return _AddImageButton(onPressed: _captureAnother);
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
          Expanded(
            child: ListView.separated(
              padding: const EdgeInsets.fromLTRB(16, 8, 16, 100),
              itemCount: _rows.length,
              separatorBuilder: (_, _) => const SizedBox(height: 8),
              itemBuilder: (context, index) {
                final row = _rows[index];
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
                                () =>
                                    _rows[index] = row.copyWith(status: status),
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
            onPressed: saveState.isLoading || widget.initialSheet.isLocked
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

  Future<void> _captureAnother() async {
    try {
      final capture = await _picker.pickImage(
        source: ImageSource.camera,
        imageQuality: 82,
        maxWidth: 2048,
      );
      if (capture != null && mounted) setState(() => _captures.add(capture));
    } catch (error) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Unable to capture image: $error')),
      );
    }
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
