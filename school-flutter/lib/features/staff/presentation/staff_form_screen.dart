import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/widgets/prototype_widgets.dart';
import '../data/staff_models.dart';
import '../data/staff_repository.dart';

const _staffRoles = [
  'TEACHER',
  'ACCOUNTANT',
  'LIBRARIAN',
  'STAFF',
  'SCHOOL_ADMIN',
];

String _roleLabel(String value) => value.replaceAll('_', ' ');

String _friendlyError(Object error) {
  if (error is DioException) {
    final data = error.response?.data;
    if (data is Map<String, dynamic>) {
      final errorBody = data['error'];
      if (errorBody is Map<String, dynamic> && errorBody['message'] is String) {
        return errorBody['message'] as String;
      }
      if (data['message'] is String) return data['message'] as String;
    }
  }
  return error.toString();
}

class StaffFormScreen extends ConsumerStatefulWidget {
  const StaffFormScreen({super.key, this.staff});

  final StaffMember? staff;

  @override
  ConsumerState<StaffFormScreen> createState() => _StaffFormScreenState();
}

class _StaffFormScreenState extends ConsumerState<StaffFormScreen> {
  final _formKey = GlobalKey<FormState>();
  late final TextEditingController _email;
  late final TextEditingController _password;
  late final TextEditingController _employeeNo;
  late final TextEditingController _firstName;
  late final TextEditingController _lastName;
  late final TextEditingController _phone;
  late final TextEditingController _gender;
  late final TextEditingController _dateOfBirth;
  late final TextEditingController _dateOfJoining;
  late final TextEditingController _address;
  late final TextEditingController _qualifications;
  late final TextEditingController _experience;
  late final TextEditingController _basicSalary;
  late final TextEditingController _paymentMode;
  late final TextEditingController _drivingLicense;
  late String _roleName;
  String? _departmentId;
  String? _designationId;
  var _saving = false;

  bool get _isEdit => widget.staff != null;

  @override
  void initState() {
    super.initState();
    final staff = widget.staff;
    _roleName = staff?.roleName ?? 'TEACHER';
    _departmentId = staff?.department?.id;
    _designationId = staff?.designation?.id;
    _email = TextEditingController(text: staff?.email ?? '');
    _password = TextEditingController();
    _employeeNo = TextEditingController(text: staff?.employeeNo ?? '');
    _firstName = TextEditingController(text: staff?.firstName ?? '');
    _lastName = TextEditingController(text: staff?.lastName ?? '');
    _phone = TextEditingController(text: staff?.phone ?? '');
    _gender = TextEditingController(text: staff?.gender ?? '');
    _dateOfBirth = TextEditingController(text: _formatDate(staff?.dateOfBirth));
    _dateOfJoining = TextEditingController(
      text: _formatDate(staff?.dateOfJoining),
    );
    _address = TextEditingController(text: staff?.currentAddress ?? '');
    _qualifications = TextEditingController(text: staff?.qualifications ?? '');
    _experience = TextEditingController(text: staff?.experience ?? '');
    _basicSalary = TextEditingController(
      text: staff?.basicSalary == null ? '' : '${staff!.basicSalary}',
    );
    _paymentMode = TextEditingController();
    _drivingLicense = TextEditingController();
  }

  @override
  void dispose() {
    _email.dispose();
    _password.dispose();
    _employeeNo.dispose();
    _firstName.dispose();
    _lastName.dispose();
    _phone.dispose();
    _gender.dispose();
    _dateOfBirth.dispose();
    _dateOfJoining.dispose();
    _address.dispose();
    _qualifications.dispose();
    _experience.dispose();
    _basicSalary.dispose();
    _paymentMode.dispose();
    _drivingLicense.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final options = ref.watch(staffOptionsProvider);
    return PrototypeScaffold(
      hero: PrototypeHero(
        label: _isEdit ? 'Edit Staff' : 'Add Staff',
        title: _isEdit ? 'Update Employee' : 'Create Employee',
        subtitle: 'Uses the live staff backend module',
        icon: Icons.badge_outlined,
      ),
      children: [
        options.when(
          loading: () => const PrototypeCard(
            child: Center(child: CircularProgressIndicator()),
          ),
          error: (error, stackTrace) => PrototypeCard(
            variant: PrototypeCardVariant.orange,
            child: Text('Unable to load setup data: ${_friendlyError(error)}'),
          ),
          data: (value) => Form(
            key: _formKey,
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                PrototypeCard(
                  child: Column(
                    children: [
                      _textField(
                        controller: _email,
                        label: 'Email',
                        keyboardType: TextInputType.emailAddress,
                        validator: _requiredEmail,
                      ),
                      if (!_isEdit) ...[
                        const SizedBox(height: 12),
                        _textField(
                          controller: _password,
                          label: 'Password',
                          obscureText: true,
                          validator: (value) {
                            if ((value ?? '').isEmpty) return null;
                            if (value!.length < 8) {
                              return 'Password must be at least 8 characters';
                            }
                            return null;
                          },
                        ),
                      ],
                      const SizedBox(height: 12),
                      DropdownButtonFormField<String>(
                        initialValue: _roleName,
                        decoration: const InputDecoration(labelText: 'Role'),
                        items: _staffRoles
                            .map(
                              (role) => DropdownMenuItem(
                                value: role,
                                child: Text(_roleLabel(role)),
                              ),
                            )
                            .toList(),
                        onChanged: (value) {
                          if (value == null) return;
                          setState(() => _roleName = value);
                        },
                      ),
                      const SizedBox(height: 12),
                      _textField(
                        controller: _employeeNo,
                        label: 'Employee number',
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: 12),
                PrototypeCard(
                  child: Column(
                    children: [
                      Row(
                        children: [
                          Expanded(
                            child: _textField(
                              controller: _firstName,
                              label: 'First name',
                              validator: _required,
                            ),
                          ),
                          const SizedBox(width: 10),
                          Expanded(
                            child: _textField(
                              controller: _lastName,
                              label: 'Last name',
                              validator: _required,
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: 12),
                      Row(
                        children: [
                          Expanded(
                            child: _textField(
                              controller: _gender,
                              label: 'Gender',
                            ),
                          ),
                          const SizedBox(width: 10),
                          Expanded(
                            child: _textField(
                              controller: _phone,
                              label: 'Phone',
                              keyboardType: TextInputType.phone,
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: 12),
                      Row(
                        children: [
                          Expanded(
                            child: _dateField(
                              context,
                              controller: _dateOfBirth,
                              label: 'Date of birth',
                            ),
                          ),
                          const SizedBox(width: 10),
                          Expanded(
                            child: _dateField(
                              context,
                              controller: _dateOfJoining,
                              label: 'Joining date',
                            ),
                          ),
                        ],
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: 12),
                PrototypeCard(
                  child: Column(
                    children: [
                      DropdownButtonFormField<String?>(
                        initialValue: _valueInOptions(
                          _departmentId,
                          value.departments,
                        ),
                        decoration: const InputDecoration(
                          labelText: 'Department',
                        ),
                        items: [
                          const DropdownMenuItem<String?>(
                            value: null,
                            child: Text('No department'),
                          ),
                          ...value.departments.map(
                            (item) => DropdownMenuItem<String?>(
                              value: item.id,
                              child: Text(item.name),
                            ),
                          ),
                        ],
                        onChanged: (value) =>
                            setState(() => _departmentId = value),
                      ),
                      const SizedBox(height: 12),
                      DropdownButtonFormField<String?>(
                        initialValue: _valueInOptions(
                          _designationId,
                          value.designations,
                        ),
                        decoration: const InputDecoration(
                          labelText: 'Designation',
                        ),
                        items: [
                          const DropdownMenuItem<String?>(
                            value: null,
                            child: Text('No designation'),
                          ),
                          ...value.designations.map(
                            (item) => DropdownMenuItem<String?>(
                              value: item.id,
                              child: Text(item.name),
                            ),
                          ),
                        ],
                        onChanged: (value) =>
                            setState(() => _designationId = value),
                      ),
                      const SizedBox(height: 12),
                      _textField(
                        controller: _qualifications,
                        label: 'Qualifications',
                      ),
                      const SizedBox(height: 12),
                      _textField(controller: _experience, label: 'Experience'),
                    ],
                  ),
                ),
                const SizedBox(height: 12),
                PrototypeCard(
                  child: Column(
                    children: [
                      _textField(
                        controller: _address,
                        label: 'Current address',
                        maxLines: 2,
                      ),
                      const SizedBox(height: 12),
                      _textField(
                        controller: _drivingLicense,
                        label: 'Driving license',
                      ),
                      const SizedBox(height: 12),
                      Row(
                        children: [
                          Expanded(
                            child: _textField(
                              controller: _basicSalary,
                              label: 'Basic salary',
                              keyboardType:
                                  const TextInputType.numberWithOptions(
                                    decimal: true,
                                  ),
                              inputFormatters: [
                                FilteringTextInputFormatter.allow(
                                  RegExp(r'^\d*\.?\d{0,2}'),
                                ),
                              ],
                            ),
                          ),
                          const SizedBox(width: 10),
                          Expanded(
                            child: _textField(
                              controller: _paymentMode,
                              label: 'Payment mode',
                            ),
                          ),
                        ],
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: 16),
                PrototypeButton(
                  label: _saving
                      ? 'Saving...'
                      : _isEdit
                      ? 'Update Employee'
                      : 'Create Employee',
                  icon: Icons.save_outlined,
                  green: true,
                  onPressed: _saving ? null : _submit,
                ),
                const SizedBox(height: 10),
                TextButton(
                  onPressed: _saving ? null : () => context.pop(false),
                  child: const Text('Cancel'),
                ),
              ],
            ),
          ),
        ),
      ],
    );
  }

  Widget _textField({
    required TextEditingController controller,
    required String label,
    TextInputType? keyboardType,
    FormFieldValidator<String>? validator,
    bool obscureText = false,
    int maxLines = 1,
    List<TextInputFormatter>? inputFormatters,
  }) {
    return TextFormField(
      controller: controller,
      decoration: InputDecoration(labelText: label),
      keyboardType: keyboardType,
      validator: validator,
      obscureText: obscureText,
      maxLines: maxLines,
      inputFormatters: inputFormatters,
    );
  }

  Widget _dateField(
    BuildContext context, {
    required TextEditingController controller,
    required String label,
  }) {
    return TextFormField(
      controller: controller,
      decoration: InputDecoration(
        labelText: label,
        suffixIcon: const Icon(Icons.calendar_month_outlined),
      ),
      readOnly: true,
      onTap: () async {
        final now = DateTime.now();
        final initial = DateTime.tryParse(controller.text) ?? now;
        final date = await showDatePicker(
          context: context,
          initialDate: initial,
          firstDate: DateTime(1950),
          lastDate: DateTime(now.year + 5),
        );
        if (date == null) return;
        controller.text = _formatDate(date);
      },
    );
  }

  String? _required(String? value) {
    if (value == null || value.trim().isEmpty) return 'Required';
    return null;
  }

  String? _requiredEmail(String? value) {
    final text = value?.trim() ?? '';
    if (text.isEmpty) return 'Required';
    if (!text.contains('@')) return 'Enter a valid email';
    return null;
  }

  StaffPayload _payload() {
    return StaffPayload(
      email: _email.text.trim(),
      password: _password.text.trim().isEmpty ? null : _password.text.trim(),
      roleName: _roleName,
      employeeNo: _emptyToNull(_employeeNo.text),
      firstName: _firstName.text.trim(),
      lastName: _lastName.text.trim(),
      departmentId: _departmentId,
      designationId: _designationId,
      gender: _emptyToNull(_gender.text),
      dateOfBirth: _emptyToNull(_dateOfBirth.text),
      dateOfJoining: _emptyToNull(_dateOfJoining.text),
      phone: _emptyToNull(_phone.text),
      currentAddress: _emptyToNull(_address.text),
      qualifications: _emptyToNull(_qualifications.text),
      experience: _emptyToNull(_experience.text),
      basicSalary: double.tryParse(_basicSalary.text.trim()),
      paymentMode: _emptyToNull(_paymentMode.text),
      drivingLicense: _emptyToNull(_drivingLicense.text),
    );
  }

  Future<void> _submit() async {
    if (!_formKey.currentState!.validate()) return;
    setState(() => _saving = true);
    try {
      final repository = ref.read(staffRepositoryProvider);
      if (_isEdit) {
        await repository.updateStaff(widget.staff!.id, _payload());
      } else {
        await repository.createStaff(_payload());
      }
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(_isEdit ? 'Employee updated' : 'Employee created'),
          ),
        );
        context.pop(true);
      }
    } catch (error) {
      if (mounted) {
        ScaffoldMessenger.of(
          context,
        ).showSnackBar(SnackBar(content: Text(_friendlyError(error))));
      }
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }
}

String _formatDate(DateTime? date) {
  if (date == null) return '';
  final month = date.month.toString().padLeft(2, '0');
  final day = date.day.toString().padLeft(2, '0');
  return '${date.year}-$month-$day';
}

String? _emptyToNull(String value) {
  final trimmed = value.trim();
  return trimmed.isEmpty ? null : trimmed;
}

String? _valueInOptions(String? value, List<StaffOption> options) {
  if (value == null) return null;
  return options.any((item) => item.id == value) ? value : null;
}
