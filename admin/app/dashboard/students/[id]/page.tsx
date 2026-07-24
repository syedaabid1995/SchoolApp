'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import PageHeader from '../../../../components/PageHeader';
import FullPageLoader from '../../../../components/FullPageLoader';
import { useNotify } from '../../../../components/NotificationProvider';
import { getSession } from '../../../../services/auth.service';
import { listAcademicYears } from '../../../../services/academic.service';
import { listSetupClasses, listSetupSections } from '../../../../services/academic-setup.service';
import {
  addStudentDocument,
  addStudentPhoto,
  addStudentTimeline,
  deleteStudentPhoto,
  deleteStudentDocument,
  deleteStudentTimeline,
  getStudent,
  resolveStudentPhotoUrl,
  resolveUploadUrl,
  unlinkParent,
  type Student,
  updateParent,
  updateStudent,
  uploadStudentDocument,
  uploadStudentPhoto,
} from '../../../../services/student.service';
import {
  listFeeInvoices,
  type FeeInvoice,
} from '../../../../services/fee-management.service';
import { listStudentTransportAssignments } from '../../../../services/transport.service';
import { listStudentDormitoryAssignments } from '../../../../services/dormitory.service';
import { cancelLibraryMember, createLibraryMember, listLibraryMembers, listMemberIssues, returnLibraryBook } from '../../../../services/library.service';

type TabKey = 'profile' | 'parents' | 'fees' | 'transport' | 'library' | 'dormitory' | 'exam' | 'documents' | 'timeline';

const tabs: Array<{ key: TabKey; label: string }> = [
  { key: 'profile', label: 'Profile' },
  { key: 'parents', label: 'Parents' },
  { key: 'fees', label: 'Fees' },
  { key: 'transport', label: 'Transport' },
  { key: 'library', label: 'Library' },
  { key: 'dormitory', label: 'Dormitory' },
  { key: 'exam', label: 'Exam' },
  { key: 'documents', label: 'Documents' },
  { key: 'timeline', label: 'Timeline' },
];

const formatDate = (value?: string | null) => {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return date.toLocaleDateString();
};

const Icon = ({ path }: { path: string }) => (
  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={path} />
  </svg>
);

const InfoRow = ({ label, value }: { label: string; value?: string | number | null }) => (
  <div className="rounded-xl border border-slate-100 bg-slate-50 px-4 py-3">
    <p className="text-xs font-bold uppercase tracking-wide text-slate-500">{label}</p>
    <p className="mt-1 text-sm font-semibold text-slate-900">{value || '-'}</p>
  </div>
);

const Field = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <label className="block">
    <span className="mb-1 block text-xs font-bold uppercase tracking-wide text-slate-500">{label}</span>
    {children}
  </label>
);

const inputClass = 'w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-100';

const dateInputValue = (value?: string | null) => {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toISOString().slice(0, 10);
};

const optionalText = (value: string) => {
  const trimmed = value.trim();
  return trimmed || null;
};

const toMoney = (value?: string | number | null) => {
  const amount = Number(value ?? 0);
  if (Number.isNaN(amount)) return '-';
  return amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

const sumInvoiceField = (items: FeeInvoice[], field: 'totalAmount' | 'discountAmount' | 'fineAmount' | 'paidAmount' | 'dueAmount') =>
  items.reduce((sum, item) => sum + Number(item[field] ?? 0), 0);

type StudentMark = NonNullable<Student['marks']>[number];

const attendanceFacePhotoUrls = (student?: Student | null) =>
  student?.faceProfile?.samples?.map((sample) => sample.imageUrl).filter((url): url is string => Boolean(url)) ?? [];

const sameStringList = (left: string[], right: string[]) =>
  left.length === right.length && left.every((value, index) => value === right[index]);

const appendFacePhotoUrl = (urls: string[], url: string) => {
  if (urls.includes(url) || urls.length >= 4) return urls;
  return [...urls, url];
};

const formatMark = (value?: number | string | null, fractionDigits = 2) => {
  if (value === undefined || value === null || value === '') return '-';
  const amount = Number(value);
  if (Number.isNaN(amount)) return '-';
  return amount.toLocaleString(undefined, { minimumFractionDigits: fractionDigits, maximumFractionDigits: fractionDigits });
};

const isPassingMark = (mark: StudentMark) => {
  const status = String(mark.status ?? '').toUpperCase();
  if (status === 'FAIL' || status === 'FAILED') return false;
  if (status === 'PASS' || status === 'PASSED') return true;
  const obtained = Number(mark.marks ?? 0);
  const passMarks = Number(mark.examPaper?.passMarks ?? 0);
  return obtained >= passMarks;
};

const getExamDivision = (percentage: number, result: 'Pass' | 'Fail') => {
  if (result === 'Fail') return 'Fail';
  if (percentage >= 60) return 'First';
  if (percentage >= 45) return 'Second';
  if (percentage >= 33) return 'Third';
  return 'Fail';
};

export default function StudentDetailPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();
  const notify = useNotify();
  const studentId = params.id as string;
  const [tab, setTab] = useState<TabKey>('profile');
  const [editMode, setEditMode] = useState(searchParams.get('edit') === '1');
  const [editForm, setEditForm] = useState({
    admissionNo: '',
    rollNo: '',
    academicSessionId: '',
    classId: '',
    sectionId: '',
    fullName: '',
    dob: '',
    gender: '',
    bloodGroup: '',
    religion: '',
    caste: '',
    phone: '',
    email: '',
    admissionDate: '',
    category: '',
    height: '',
    weight: '',
    fatherName: '',
    fatherOccupation: '',
    fatherPhone: '',
    motherName: '',
    motherOccupation: '',
    motherPhone: '',
    guardianName: '',
    guardianRelationship: '',
    parentPhone: '',
    parentEmail: '',
    presentAddress: '',
    permanentAddress: '',
    city: '',
    state: '',
    pincode: '',
    emergencyContact: '',
    medicalConditions: '',
    allergies: '',
    doctorContact: '',
    docBirthCert: '',
    docTransferCert: '',
    docAadhaar: '',
    docReportCard: '',
    photoUrl: null as string | null,
    facePhotoUrls: [] as string[],
  });
  const [parentAccountEdit, setParentAccountEdit] = useState<{
    id: string;
    firstName: string;
    lastName: string;
    phone: string;
    email: string;
  } | null>(null);
  const [documentForm, setDocumentForm] = useState({ title: '', file: null as File | null });
  const [timelineForm, setTimelineForm] = useState({ title: '', description: '', timelineDate: new Date().toISOString().slice(0, 10) });
  const [photoUploadTarget, setPhotoUploadTarget] = useState<'student' | 'gallery' | 'face' | null>(null);

  const { data: session, isLoading: isSessionLoading } = useQuery({ queryKey: ['session'], queryFn: getSession });
  const isSuperAdmin = session?.role === 'SUPER_ADMIN';
  const isSchoolAdmin = session?.role === 'SCHOOL_ADMIN';
  const permissionCodes = session?.permissionCodes ?? [];
  const hasPermission = (code: string) => isSuperAdmin || isSchoolAdmin || permissionCodes.includes(code);
  const canViewStudent = hasPermission('students.list') || hasPermission('student.view');
  const canEditStudent = hasPermission('student.edit');
  const canCreateDocument = hasPermission('student.document.create');
  const canDeleteDocument = hasPermission('student.document.delete');
  const canCreateTimeline = hasPermission('student.timeline.create');
  const canDeleteTimeline = hasPermission('student.timeline.delete');

  const studentQuery = useQuery({
    queryKey: ['student', studentId],
    queryFn: () => getStudent(studentId),
    enabled: Boolean(studentId) && canViewStudent,
  });
  const student = studentQuery.data;
  const displayName = student ? student.fullName ?? `${student.firstName} ${student.lastName}`.trim() : '';
  const effectiveSchoolId = student?.schoolId;

  const academicYearsQuery = useQuery({
    queryKey: ['student-detail-academic-years', effectiveSchoolId],
    queryFn: () => listAcademicYears(effectiveSchoolId ? { schoolId: effectiveSchoolId } : undefined),
    enabled: Boolean(student?.id) && canEditStudent && editMode,
  });
  const classesQuery = useQuery({
    queryKey: ['student-detail-classes', effectiveSchoolId],
    queryFn: () => listSetupClasses(effectiveSchoolId ? { schoolId: effectiveSchoolId } : undefined),
    enabled: Boolean(student?.id) && canEditStudent && editMode,
  });
  const sectionsQuery = useQuery({
    queryKey: ['student-detail-sections', effectiveSchoolId],
    queryFn: () => listSetupSections(effectiveSchoolId ? { schoolId: effectiveSchoolId } : undefined),
    enabled: Boolean(student?.id) && canEditStudent && editMode,
  });
  const availableSections = (sectionsQuery.data ?? []).filter((section: any) => {
    if (!editForm.classId) return true;
    if (section.classId) return section.classId === editForm.classId;
    return (section.classSections ?? []).some((link: any) => link.classId === editForm.classId);
  });

  const feeInvoicesQuery = useQuery({
    queryKey: ['student-fee-invoices', studentId, student?.academicSessionId],
    queryFn: () => listFeeInvoices({ studentId, academicSessionId: student?.academicSessionId ?? undefined, limit: 100, sortBy: 'dueDate', sortOrder: 'desc' }),
    enabled: Boolean(studentId) && Boolean(student?.id) && canViewStudent && tab === 'fees',
  });

  const transportQuery = useQuery({
    queryKey: ['student-detail-transport', studentId, student?.classId, student?.sectionId],
    queryFn: () => listStudentTransportAssignments({
      classId: student?.classId ?? undefined,
      sectionId: student?.sectionId ?? undefined,
      search: student?.classId ? undefined : student?.admissionNo || displayName,
      active: 'all',
    }),
    enabled: Boolean(student?.id) && canViewStudent && tab === 'transport',
  });
  const dormitoryQuery = useQuery({
    queryKey: ['student-detail-dormitory', studentId, student?.classId, student?.sectionId],
    queryFn: () => listStudentDormitoryAssignments({
      classId: student?.classId ?? undefined,
      sectionId: student?.sectionId ?? undefined,
      search: student?.classId ? undefined : student?.admissionNo || displayName,
      active: 'all',
    }),
    enabled: Boolean(student?.id) && canViewStudent && tab === 'dormitory',
  });
  const libraryMembersQuery = useQuery({
    queryKey: ['student-detail-library-members', studentId, student?.admissionNo],
    queryFn: () => listLibraryMembers({ search: student?.admissionNo || displayName, active: true }),
    enabled: Boolean(student?.id) && canViewStudent && tab === 'library',
  });
  const libraryMember = (libraryMembersQuery.data ?? []).find((member) => member.studentId === studentId || member.fullName.toLowerCase() === displayName.toLowerCase());
  const libraryIssuesQuery = useQuery({
    queryKey: ['student-detail-library-issues', studentId, libraryMember?.id],
    queryFn: () => listMemberIssues(libraryMember!.id),
    enabled: Boolean(libraryMember?.id) && canViewStudent && tab === 'library',
  });
  const feeInvoices = feeInvoicesQuery.data?.items ?? [];
  const transportAssignments = (transportQuery.data ?? []).filter((item) => item.student?.id === studentId);
  const dormitoryAssignments = (dormitoryQuery.data ?? []).filter((item) => item.student?.id === studentId);
  const libraryIssues = libraryIssuesQuery.data ?? [];
  const examGroups = Object.values(
    (student?.marks ?? []).reduce<Record<string, { id: string; name: string; marks: StudentMark[] }>>((groups, mark) => {
      const examId = mark.examPaper?.exam?.id ?? 'unassigned';
      const examName = mark.examPaper?.exam?.name ?? 'Unassigned Exam';
      if (!groups[examId]) groups[examId] = { id: examId, name: examName, marks: [] };
      groups[examId].marks.push(mark);
      return groups;
    }, {}),
  ).map((exam) => {
    const grandTotal = exam.marks.reduce((sum, mark) => sum + Number(mark.examPaper?.maxMarks ?? 0), 0);
    const totalObtained = exam.marks.reduce((sum, mark) => sum + Number(mark.marks ?? 0), 0);
    const percentage = grandTotal > 0 ? (totalObtained / grandTotal) * 100 : 0;
    const result: 'Pass' | 'Fail' = exam.marks.every(isPassingMark) ? 'Pass' : 'Fail';
    return {
      ...exam,
      grandTotal,
      totalObtained,
      percentage,
      result,
      division: getExamDivision(percentage, result),
    };
  });

  useEffect(() => {
    if (!student) return;
    setEditForm({
      admissionNo: student.admissionNo ?? '',
      rollNo: student.rollNo ?? '',
      academicSessionId: student.academicSessionId ?? '',
      classId: student.classId ?? '',
      sectionId: student.sectionId ?? '',
      fullName: displayName,
      dob: dateInputValue(student.dob),
      gender: student.gender ?? '',
      bloodGroup: student.bloodGroup ?? '',
      religion: student.religion ?? '',
      caste: student.caste ?? '',
      phone: student.phone ?? '',
      email: student.email ?? '',
      admissionDate: dateInputValue(student.admissionDate),
      category: student.category ?? '',
      height: student.height === undefined || student.height === null ? '' : String(student.height),
      weight: student.weight === undefined || student.weight === null ? '' : String(student.weight),
      fatherName: student.fatherName ?? '',
      fatherOccupation: student.fatherOccupation ?? '',
      fatherPhone: student.fatherPhone ?? '',
      motherName: student.motherName ?? '',
      motherOccupation: student.motherOccupation ?? '',
      motherPhone: student.motherPhone ?? '',
      guardianName: student.guardianName ?? '',
      guardianRelationship: student.guardianRelationship ?? '',
      parentPhone: student.parentPhone ?? '',
      parentEmail: student.parentEmail ?? '',
      presentAddress: student.presentAddress ?? student.addressLine1 ?? '',
      permanentAddress: student.permanentAddress ?? student.addressLine2 ?? '',
      city: student.city ?? '',
      state: student.state ?? '',
      pincode: student.pincode ?? '',
      emergencyContact: student.emergencyContact ?? '',
      medicalConditions: student.medicalConditions ?? '',
      allergies: student.allergies ?? '',
      doctorContact: student.doctorContact ?? '',
      docBirthCert: student.docBirthCert ?? '',
      docTransferCert: student.docTransferCert ?? '',
      docAadhaar: student.docAadhaar ?? '',
      docReportCard: student.docReportCard ?? '',
      photoUrl: student.photoUrl ?? null,
      facePhotoUrls: attendanceFacePhotoUrls(student),
    });
  }, [student, displayName]);

  const updateMutation = useMutation({
    mutationFn: () => {
      const payload: Parameters<typeof updateStudent>[1] = {
        admissionNo: editForm.admissionNo.trim(),
        rollNo: optionalText(editForm.rollNo),
        academicSessionId: editForm.academicSessionId || null,
        classId: editForm.classId || null,
        sectionId: editForm.sectionId || null,
        fullName: editForm.fullName.trim(),
        dob: editForm.dob || null,
        gender: optionalText(editForm.gender),
        bloodGroup: optionalText(editForm.bloodGroup),
        religion: optionalText(editForm.religion),
        caste: optionalText(editForm.caste),
        email: optionalText(editForm.email),
        phone: optionalText(editForm.phone),
        admissionDate: editForm.admissionDate || null,
        category: optionalText(editForm.category),
        height: editForm.height.trim() ? Number(editForm.height) : null,
        weight: editForm.weight.trim() ? Number(editForm.weight) : null,
        fatherName: optionalText(editForm.fatherName),
        fatherOccupation: optionalText(editForm.fatherOccupation),
        fatherPhone: optionalText(editForm.fatherPhone),
        motherName: optionalText(editForm.motherName),
        motherOccupation: optionalText(editForm.motherOccupation),
        motherPhone: optionalText(editForm.motherPhone),
        guardianName: optionalText(editForm.guardianName),
        guardianRelationship: optionalText(editForm.guardianRelationship),
        parentPhone: optionalText(editForm.parentPhone),
        parentEmail: optionalText(editForm.parentEmail),
        presentAddress: optionalText(editForm.presentAddress),
        permanentAddress: optionalText(editForm.permanentAddress),
        addressLine1: optionalText(editForm.presentAddress),
        addressLine2: optionalText(editForm.permanentAddress),
        city: optionalText(editForm.city),
        state: optionalText(editForm.state),
        pincode: optionalText(editForm.pincode),
        emergencyContact: optionalText(editForm.emergencyContact),
        medicalConditions: optionalText(editForm.medicalConditions),
        allergies: optionalText(editForm.allergies),
        doctorContact: optionalText(editForm.doctorContact),
        docBirthCert: optionalText(editForm.docBirthCert),
        docTransferCert: optionalText(editForm.docTransferCert),
        docAadhaar: optionalText(editForm.docAadhaar),
        docReportCard: optionalText(editForm.docReportCard),
        photoUrl: editForm.photoUrl,
        facePhotoUrls: editForm.facePhotoUrls,
      };
      if (!payload.admissionNo || !payload.fullName) {
        throw new Error('Admission number and full name are required.');
      }
      if (editForm.height.trim() && Number.isNaN(Number(editForm.height))) throw new Error('Height must be a valid number.');
      if (editForm.weight.trim() && Number.isNaN(Number(editForm.weight))) throw new Error('Weight must be a valid number.');
      if (sameStringList(editForm.facePhotoUrls, attendanceFacePhotoUrls(student))) {
        delete payload.facePhotoUrls;
      }
      return updateStudent(studentId, payload);
    },
    onSuccess: (updated: any) => {
      notify.success('Student updated', 'Profile changes were saved.');
      if (updated?.faceRegistration?.success) {
        notify.success('Face registration updated', `${updated.faceRegistration.sampleCount} attendance face sample${updated.faceRegistration.sampleCount === 1 ? '' : 's'} saved.`);
      } else if (updated?.faceRegistration) {
        notify.error('Face registration failed', updated.faceRegistration.error ?? 'Profile was saved, but attendance face registration failed.');
      }
      setEditMode(false);
      queryClient.invalidateQueries({ queryKey: ['student', studentId] });
      queryClient.invalidateQueries({ queryKey: ['students'] });
    },
    onError: (error: any) => notify.error('Update failed', error?.response?.data?.error?.message ?? error?.message ?? 'Unable to update student.'),
  });

  const updateParentMutation = useMutation({
    mutationFn: async () => {
      if (!parentAccountEdit) throw new Error('Select a parent account to update.');
      if (!parentAccountEdit.firstName.trim()) throw new Error('Parent first name is required.');
      return updateParent(parentAccountEdit.id, {
        firstName: parentAccountEdit.firstName.trim(),
        lastName: parentAccountEdit.lastName.trim() || 'Guardian',
        phone: optionalText(parentAccountEdit.phone),
        email: optionalText(parentAccountEdit.email),
        schoolId: effectiveSchoolId,
      });
    },
    onSuccess: () => {
      notify.success('Parent account updated', 'Linked parent account details were saved.');
      setParentAccountEdit(null);
      queryClient.invalidateQueries({ queryKey: ['student', studentId] });
    },
    onError: (error: any) => notify.error('Parent update failed', error?.response?.data?.error?.message ?? error?.message ?? 'Unable to update parent account.'),
  });

  const unlinkParentMutation = useMutation({
    mutationFn: (parentId: string) => unlinkParent(studentId, parentId),
    onSuccess: () => {
      notify.success('Parent unlinked', 'Parent account was removed from this student.');
      setParentAccountEdit(null);
      queryClient.invalidateQueries({ queryKey: ['student', studentId] });
    },
    onError: (error: any) => notify.error('Unlink failed', error?.response?.data?.error?.message ?? 'Unable to unlink parent account.'),
  });

  const createLibraryMemberMutation = useMutation({
    mutationFn: () => createLibraryMember({ schoolId: effectiveSchoolId, memberType: 'STUDENT', memberId: studentId }),
    onSuccess: () => {
      notify.success('Library member created', 'Student was registered as a library member.');
      queryClient.invalidateQueries({ queryKey: ['student-detail-library-members'] });
    },
    onError: (error: any) => notify.error('Library update failed', error?.response?.data?.error?.message ?? 'Unable to register library member.'),
  });

  const cancelLibraryMemberMutation = useMutation({
    mutationFn: (memberId: string) => cancelLibraryMember(memberId, effectiveSchoolId ? { schoolId: effectiveSchoolId } : undefined),
    onSuccess: () => {
      notify.success('Library member cancelled', 'Library membership was cancelled.');
      queryClient.invalidateQueries({ queryKey: ['student-detail-library-members'] });
      queryClient.invalidateQueries({ queryKey: ['student-detail-library-issues'] });
    },
    onError: (error: any) => notify.error('Library update failed', error?.response?.data?.error?.message ?? 'Unable to cancel library member.'),
  });

  const returnLibraryIssueMutation = useMutation({
    mutationFn: (issueId: string) => returnLibraryBook(issueId, effectiveSchoolId ? { schoolId: effectiveSchoolId } : undefined),
    onSuccess: () => {
      notify.success('Book returned', 'Library issue was marked as returned.');
      queryClient.invalidateQueries({ queryKey: ['student-detail-library-issues'] });
    },
    onError: (error: any) => notify.error('Return failed', error?.response?.data?.error?.message ?? 'Unable to return library book.'),
  });

  const uploadImageFile = async (file: File, target: 'student' | 'gallery' | 'face') => {
    if (!file.type.startsWith('image/')) {
      notify.error('Invalid image', 'Only image files are allowed.');
      return;
    }
    if (file.size > 3 * 1024 * 1024) {
      notify.error('Image too large', 'Use an image smaller than 3 MB.');
      return;
    }
    setPhotoUploadTarget(target);
    try {
      const uploaded = await uploadStudentPhoto(file, { studentId });
      if (target === 'student') {
        const facePhotoLimitReached = editForm.facePhotoUrls.length >= 4 && !editForm.facePhotoUrls.includes(uploaded.url);
        setEditForm((prev) => ({ ...prev, photoUrl: uploaded.url, facePhotoUrls: appendFacePhotoUrl(prev.facePhotoUrls, uploaded.url) }));
        notify.success(
          'Student photo uploaded',
          facePhotoLimitReached
            ? 'Save changes to apply the new profile photo. Attendance face photo limit is already full.'
            : 'Save changes to apply the new profile photo and register it for AI attendance.',
        );
      } else if (target === 'face') {
        setEditForm((prev) => {
          if (prev.facePhotoUrls.length >= 4) return prev;
          return { ...prev, facePhotoUrls: [...prev.facePhotoUrls, uploaded.url] };
        });
        notify.success('Attendance photo uploaded', 'Save changes to register it for AI attendance.');
      } else {
        await addStudentPhoto(studentId, uploaded.url);
        notify.success('Photo added', 'Student photo gallery was updated.');
        queryClient.invalidateQueries({ queryKey: ['student', studentId] });
      }
    } catch (error: any) {
      notify.error('Upload failed', error?.response?.data?.error?.message ?? 'Unable to upload image.');
    } finally {
      setPhotoUploadTarget(null);
    }
  };

  const deleteGalleryPhotoMutation = useMutation({
    mutationFn: (photoId: string) => deleteStudentPhoto(studentId, photoId),
    onSuccess: () => {
      notify.success('Photo deleted', 'Student photo was removed.');
      queryClient.invalidateQueries({ queryKey: ['student', studentId] });
      queryClient.invalidateQueries({ queryKey: ['students'] });
    },
    onError: (error: any) => notify.error('Delete failed', error?.response?.data?.error?.message ?? 'Unable to delete photo.'),
  });

  const documentMutation = useMutation({
    mutationFn: async () => {
      if (!documentForm.file) throw new Error('Select a document.');
      if (!documentForm.title.trim()) throw new Error('Document title is required.');
      const uploaded = await uploadStudentDocument(documentForm.file, studentId);
      return addStudentDocument(studentId, {
        title: documentForm.title.trim(),
        url: uploaded.url,
        fileName: uploaded.filename,
        mimeType: documentForm.file.type,
        sizeBytes: documentForm.file.size,
      });
    },
    onSuccess: () => {
      notify.success('Document uploaded', 'Student document was added.');
      setDocumentForm({ title: '', file: null });
      queryClient.invalidateQueries({ queryKey: ['student', studentId] });
    },
    onError: (error: any) => notify.error('Upload failed', error?.response?.data?.error?.message ?? error.message ?? 'Unable to upload document.'),
  });

  const timelineMutation = useMutation({
    mutationFn: () => {
      if (!timelineForm.title.trim()) throw new Error('Timeline title is required.');
      return addStudentTimeline(studentId, {
        title: timelineForm.title.trim(),
        description: timelineForm.description.trim() || null,
        timelineDate: timelineForm.timelineDate,
      });
    },
    onSuccess: () => {
      notify.success('Timeline added', 'Timeline item was saved.');
      setTimelineForm({ title: '', description: '', timelineDate: new Date().toISOString().slice(0, 10) });
      queryClient.invalidateQueries({ queryKey: ['student', studentId] });
    },
    onError: (error: any) => notify.error('Timeline failed', error?.response?.data?.error?.message ?? error.message ?? 'Unable to save timeline.'),
  });

  const deleteDocumentMutation = useMutation({
    mutationFn: (documentId: string) => deleteStudentDocument(studentId, documentId),
    onSuccess: () => {
      notify.success('Document deleted', 'Student document was removed.');
      queryClient.invalidateQueries({ queryKey: ['student', studentId] });
    },
  });

  const deleteTimelineMutation = useMutation({
    mutationFn: (timelineId: string) => deleteStudentTimeline(studentId, timelineId),
    onSuccess: () => {
      notify.success('Timeline deleted', 'Timeline item was removed.');
      queryClient.invalidateQueries({ queryKey: ['student', studentId] });
    },
  });

  if (isSessionLoading || !session?.role || studentQuery.isLoading) {
    return <FullPageLoader label="Loading student details..." />;
  }
  if (!canViewStudent) {
    return (
      <section className="rounded-2xl border border-amber-200 bg-amber-50 p-6 text-sm font-semibold text-amber-800">
        Student details are not enabled for your role. Ask a School Admin to update Role Permissions.
      </section>
    );
  }

  if (!student) {
    return (
      <div className="p-6">
        <PageHeader title="Student Not Found" breadcrumbs={[{ label: 'Dashboard', href: '/dashboard' }, { label: 'Students', href: '/dashboard/students' }, { label: 'Not Found' }]} />
      </div>
    );
  }

  const photo = resolveStudentPhotoUrl(student);

  return (
    <div className="min-h-screen bg-slate-100 pb-10">
      <div className="mx-auto w-full max-w-[1500px] px-4 py-6 lg:px-8">
        <PageHeader
          title={displayName}
          subtitle="View profile, parents, fees, transport, library, dormitory, exam results, documents, and timeline."
          breadcrumbs={[{ label: 'Dashboard', href: '/dashboard' }, { label: 'Students', href: '/dashboard/students' }, { label: displayName }]}
        />

        <div className="grid gap-5 lg:grid-cols-[320px_1fr]">
          <aside className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="h-28 bg-gradient-to-r from-violet-600 to-indigo-600" />
            <div className="-mt-12 px-5 pb-5">
              <div className="grid h-24 w-24 place-items-center overflow-hidden rounded-2xl border-4 border-white bg-violet-100 text-2xl font-bold text-violet-700 shadow">
                {photo ? <img src={photo} alt={displayName} className="h-full w-full object-cover" /> : displayName.slice(0, 2).toUpperCase()}
              </div>
              <h2 className="mt-4 text-xl font-bold text-slate-950">{displayName}</h2>
              <p className="text-sm text-slate-500">Admission: {student.admissionNo}</p>
              <div className="mt-4 space-y-2 text-sm">
                <InfoRow label="Roll number" value={student.rollNo} />
                <InfoRow label="Class" value={`${student.class?.name ?? '-'}${student.section?.name ? ` - ${student.section.name}` : ''}`} />
                <InfoRow label="Gender" value={student.gender} />
                <InfoRow label="Status" value={student.status} />
              </div>
              <div className="mt-5 flex gap-2">
                {canEditStudent ? <button onClick={() => setEditMode(true)} className="flex-1 rounded-xl bg-[var(--theme-button-bg)] px-4 py-2 text-sm font-bold text-[var(--theme-button-text)]">Edit</button> : null}
                <Link href="/dashboard/students" className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-bold text-slate-700">Back</Link>
              </div>
            </div>
          </aside>

          <main className="space-y-5">
            <div className="rounded-2xl border border-slate-200 bg-white p-2 shadow-sm">
              <div className="flex flex-wrap gap-2">
                {tabs.map((item) => (
                  <button
                    key={item.key}
                    onClick={() => setTab(item.key)}
                    className={`rounded-xl px-4 py-2 text-sm font-bold ${tab === item.key ? 'bg-violet-600 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-50'}`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>

            {editMode && canEditStudent && (
              <section className="rounded-2xl border border-violet-100 bg-white p-5 shadow-sm">
                <div className="mb-4 flex items-center justify-between">
                  <h2 className="text-lg font-bold text-slate-950">Edit Student Details</h2>
                  <button onClick={() => setEditMode(false)} className="text-sm font-semibold text-slate-500">Cancel</button>
                </div>

                <div className="space-y-6">
                  <div>
                    <h3 className="mb-3 text-sm font-black uppercase tracking-wide text-slate-500">Academic</h3>
                    <div className="grid gap-4 md:grid-cols-3">
                      <Field label="Admission number">
                        <input value={editForm.admissionNo} onChange={(event) => setEditForm({ ...editForm, admissionNo: event.target.value })} className={inputClass} />
                      </Field>
                      <Field label="Roll number">
                        <input value={editForm.rollNo} onChange={(event) => setEditForm({ ...editForm, rollNo: event.target.value })} className={inputClass} />
                      </Field>
                      <Field label="Admission date">
                        <input type="date" value={editForm.admissionDate} onChange={(event) => setEditForm({ ...editForm, admissionDate: event.target.value })} className={inputClass} />
                      </Field>
                      <Field label="Academic session">
                        <select value={editForm.academicSessionId} onChange={(event) => setEditForm({ ...editForm, academicSessionId: event.target.value })} className={inputClass}>
                          <option value="">No session</option>
                          {(academicYearsQuery.data ?? []).map((year: any) => <option key={year.id} value={year.id}>{year.name}</option>)}
                        </select>
                      </Field>
                      <Field label="Class">
                        <select
                          value={editForm.classId}
                          onChange={(event) => setEditForm((prev) => ({ ...prev, classId: event.target.value, sectionId: '' }))}
                          className={inputClass}
                        >
                          <option value="">No class</option>
                          {(classesQuery.data ?? []).map((item: any) => <option key={item.id} value={item.id}>{item.name}</option>)}
                        </select>
                      </Field>
                      <Field label="Section">
                        <select value={editForm.sectionId} onChange={(event) => setEditForm({ ...editForm, sectionId: event.target.value })} className={inputClass}>
                          <option value="">No section</option>
                          {availableSections.map((item: any) => <option key={item.id} value={item.id}>{item.name}</option>)}
                        </select>
                      </Field>
                    </div>
                  </div>

                  <div>
                    <h3 className="mb-3 text-sm font-black uppercase tracking-wide text-slate-500">Student Profile</h3>
                    <div className="grid gap-4 md:grid-cols-3">
                      <Field label="Full name">
                        <input value={editForm.fullName} onChange={(event) => setEditForm({ ...editForm, fullName: event.target.value })} className={inputClass} />
                      </Field>
                      <Field label="Date of birth">
                        <input type="date" value={editForm.dob} onChange={(event) => setEditForm({ ...editForm, dob: event.target.value })} className={inputClass} />
                      </Field>
                      <Field label="Gender">
                        <select value={editForm.gender} onChange={(event) => setEditForm({ ...editForm, gender: event.target.value })} className={inputClass}>
                          <option value="">Select gender</option>
                          <option value="Male">Male</option>
                          <option value="Female">Female</option>
                          <option value="Other">Other</option>
                        </select>
                      </Field>
                      <Field label="Blood group">
                        <input value={editForm.bloodGroup} onChange={(event) => setEditForm({ ...editForm, bloodGroup: event.target.value })} className={inputClass} />
                      </Field>
                      <Field label="Religion">
                        <input value={editForm.religion} onChange={(event) => setEditForm({ ...editForm, religion: event.target.value })} className={inputClass} />
                      </Field>
                      <Field label="Caste">
                        <input value={editForm.caste} onChange={(event) => setEditForm({ ...editForm, caste: event.target.value })} className={inputClass} />
                      </Field>
                      <Field label="Category">
                        <input value={editForm.category} onChange={(event) => setEditForm({ ...editForm, category: event.target.value })} className={inputClass} />
                      </Field>
                      <Field label="Phone">
                        <input value={editForm.phone} onChange={(event) => setEditForm({ ...editForm, phone: event.target.value })} className={inputClass} />
                      </Field>
                      <Field label="Email">
                        <input type="email" value={editForm.email} onChange={(event) => setEditForm({ ...editForm, email: event.target.value })} className={inputClass} />
                      </Field>
                      <Field label="Height">
                        <input value={editForm.height} onChange={(event) => setEditForm({ ...editForm, height: event.target.value })} className={inputClass} />
                      </Field>
                      <Field label="Weight">
                        <input value={editForm.weight} onChange={(event) => setEditForm({ ...editForm, weight: event.target.value })} className={inputClass} />
                      </Field>
                    </div>
                  </div>

                  <div>
                    <h3 className="mb-3 text-sm font-black uppercase tracking-wide text-slate-500">Parents & Guardians</h3>
                    <div className="grid gap-4 md:grid-cols-3">
                      <Field label="Father name">
                        <input value={editForm.fatherName} onChange={(event) => setEditForm({ ...editForm, fatherName: event.target.value })} className={inputClass} />
                      </Field>
                      <Field label="Father phone">
                        <input value={editForm.fatherPhone} onChange={(event) => setEditForm({ ...editForm, fatherPhone: event.target.value })} className={inputClass} />
                      </Field>
                      <Field label="Father occupation">
                        <input value={editForm.fatherOccupation} onChange={(event) => setEditForm({ ...editForm, fatherOccupation: event.target.value })} className={inputClass} />
                      </Field>
                      <Field label="Mother name">
                        <input value={editForm.motherName} onChange={(event) => setEditForm({ ...editForm, motherName: event.target.value })} className={inputClass} />
                      </Field>
                      <Field label="Mother phone">
                        <input value={editForm.motherPhone} onChange={(event) => setEditForm({ ...editForm, motherPhone: event.target.value })} className={inputClass} />
                      </Field>
                      <Field label="Mother occupation">
                        <input value={editForm.motherOccupation} onChange={(event) => setEditForm({ ...editForm, motherOccupation: event.target.value })} className={inputClass} />
                      </Field>
                      <Field label="Guardian name">
                        <input value={editForm.guardianName} onChange={(event) => setEditForm({ ...editForm, guardianName: event.target.value })} className={inputClass} />
                      </Field>
                      <Field label="Guardian relationship">
                        <input value={editForm.guardianRelationship} onChange={(event) => setEditForm({ ...editForm, guardianRelationship: event.target.value })} className={inputClass} />
                      </Field>
                      <Field label="Parent login phone">
                        <input value={editForm.parentPhone} onChange={(event) => setEditForm({ ...editForm, parentPhone: event.target.value })} className={inputClass} />
                      </Field>
                      <Field label="Parent email">
                        <input type="email" value={editForm.parentEmail} onChange={(event) => setEditForm({ ...editForm, parentEmail: event.target.value })} className={inputClass} />
                      </Field>
                    </div>
                  </div>

                  <div>
                    <h3 className="mb-3 text-sm font-black uppercase tracking-wide text-slate-500">Address, Health & References</h3>
                    <div className="grid gap-4 md:grid-cols-3">
                      <Field label="Present address">
                        <textarea value={editForm.presentAddress} onChange={(event) => setEditForm({ ...editForm, presentAddress: event.target.value })} className={`${inputClass} min-h-20`} />
                      </Field>
                      <Field label="Permanent address">
                        <textarea value={editForm.permanentAddress} onChange={(event) => setEditForm({ ...editForm, permanentAddress: event.target.value })} className={`${inputClass} min-h-20`} />
                      </Field>
                      <div className="grid gap-4">
                        <Field label="City">
                          <input value={editForm.city} onChange={(event) => setEditForm({ ...editForm, city: event.target.value })} className={inputClass} />
                        </Field>
                        <Field label="State">
                          <input value={editForm.state} onChange={(event) => setEditForm({ ...editForm, state: event.target.value })} className={inputClass} />
                        </Field>
                      </div>
                      <Field label="Pincode">
                        <input value={editForm.pincode} onChange={(event) => setEditForm({ ...editForm, pincode: event.target.value })} className={inputClass} />
                      </Field>
                      <Field label="Emergency contact">
                        <input value={editForm.emergencyContact} onChange={(event) => setEditForm({ ...editForm, emergencyContact: event.target.value })} className={inputClass} />
                      </Field>
                      <Field label="Doctor contact">
                        <input value={editForm.doctorContact} onChange={(event) => setEditForm({ ...editForm, doctorContact: event.target.value })} className={inputClass} />
                      </Field>
                      <Field label="Medical conditions">
                        <input value={editForm.medicalConditions} onChange={(event) => setEditForm({ ...editForm, medicalConditions: event.target.value })} className={inputClass} />
                      </Field>
                      <Field label="Allergies">
                        <input value={editForm.allergies} onChange={(event) => setEditForm({ ...editForm, allergies: event.target.value })} className={inputClass} />
                      </Field>
                      <Field label="Birth certificate ref">
                        <input value={editForm.docBirthCert} onChange={(event) => setEditForm({ ...editForm, docBirthCert: event.target.value })} className={inputClass} />
                      </Field>
                      <Field label="Transfer certificate ref">
                        <input value={editForm.docTransferCert} onChange={(event) => setEditForm({ ...editForm, docTransferCert: event.target.value })} className={inputClass} />
                      </Field>
                      <Field label="Aadhaar ref">
                        <input value={editForm.docAadhaar} onChange={(event) => setEditForm({ ...editForm, docAadhaar: event.target.value })} className={inputClass} />
                      </Field>
                      <Field label="Report card ref">
                        <input value={editForm.docReportCard} onChange={(event) => setEditForm({ ...editForm, docReportCard: event.target.value })} className={inputClass} />
                      </Field>
                    </div>
                  </div>
                </div>

                <div className="mt-5 grid gap-5 lg:grid-cols-3">
                  <div>
                    <p className="text-sm font-bold text-slate-900">Student photo</p>
                    <div className="mt-3 flex items-center gap-3">
                      <div className="grid h-20 w-20 shrink-0 place-items-center overflow-hidden rounded-xl border border-slate-200 bg-slate-50 text-sm font-bold text-slate-500">
                        {editForm.photoUrl ? <img src={resolveUploadUrl(editForm.photoUrl) ?? editForm.photoUrl} alt={displayName} className="h-full w-full object-cover" /> : displayName.slice(0, 2).toUpperCase()}
                      </div>
                      <div className="space-y-2">
                        <input
                          type="file"
                          accept="image/*"
                          className="block text-xs"
                          disabled={photoUploadTarget === 'student'}
                          onChange={(event) => {
                            const file = event.target.files?.[0];
                            if (file) uploadImageFile(file, 'student');
                            event.target.value = '';
                          }}
                        />
                        {editForm.photoUrl ? (
                          <button type="button" onClick={() => setEditForm((prev) => ({ ...prev, photoUrl: null }))} className="text-xs font-bold text-red-600">
                            Remove photo
                          </button>
                        ) : null}
                      </div>
                    </div>
                  </div>

                  <div>
                    <p className="text-sm font-bold text-slate-900">Photo gallery</p>
                    <input
                      type="file"
                      accept="image/*"
                      className="mt-3 block text-xs"
                      disabled={photoUploadTarget === 'gallery'}
                      onChange={(event) => {
                        const file = event.target.files?.[0];
                        if (file) uploadImageFile(file, 'gallery');
                        event.target.value = '';
                      }}
                    />
                    <div className="mt-3 flex flex-wrap gap-2">
                      {student.photos?.length ? student.photos.map((item) => (
                        <div key={item.id} className="group relative h-16 w-16 overflow-hidden rounded-lg border border-slate-200 bg-slate-50">
                          <img src={resolveUploadUrl(item.url) ?? item.url} alt="Student gallery" className="h-full w-full object-cover" />
                          <button
                            type="button"
                            disabled={deleteGalleryPhotoMutation.isPending}
                            onClick={() => deleteGalleryPhotoMutation.mutate(item.id)}
                            className="absolute right-1 top-1 hidden rounded bg-red-600 px-1.5 py-0.5 text-xs font-bold text-white group-hover:block disabled:opacity-50"
                          >
                            x
                          </button>
                        </div>
                      )) : <p className="text-xs text-slate-500">No gallery photos.</p>}
                    </div>
                  </div>

                  <div>
                    <p className="text-sm font-bold text-slate-900">Attendance face photos</p>
                    <input
                      type="file"
                      accept="image/*"
                      multiple
                      className="mt-3 block text-xs"
                      disabled={photoUploadTarget === 'face' || editForm.facePhotoUrls.length >= 4}
                      onChange={async (event) => {
                        const files = Array.from(event.target.files ?? []);
                        if (!files.length) return;
                        const remainingSlots = 4 - editForm.facePhotoUrls.length;
                        if (files.length > remainingSlots) {
                          notify.error('Too many face photos', `You can add ${remainingSlots} more face photo${remainingSlots === 1 ? '' : 's'} for this student.`);
                          event.target.value = '';
                          return;
                        }
                        for (const file of files) {
                          await uploadImageFile(file, 'face');
                        }
                        event.target.value = '';
                      }}
                    />
                    <div className="mt-3 flex flex-wrap gap-2">
                      {editForm.facePhotoUrls.length ? editForm.facePhotoUrls.map((url, index) => (
                        <div key={`${url}-${index}`} className="group relative h-16 w-16 overflow-hidden rounded-lg border border-violet-200 bg-violet-50">
                          <img src={resolveUploadUrl(url) ?? url} alt={`Attendance face ${index + 1}`} className="h-full w-full object-cover" />
                          <button
                            type="button"
                            onClick={() => setEditForm((prev) => ({ ...prev, facePhotoUrls: prev.facePhotoUrls.filter((_, itemIndex) => itemIndex !== index) }))}
                            className="absolute right-1 top-1 hidden rounded bg-red-600 px-1.5 py-0.5 text-xs font-bold text-white group-hover:block"
                          >
                            x
                          </button>
                        </div>
                      )) : <p className="text-xs text-slate-500">No attendance face photos registered.</p>}
                    </div>
                    <p className="mt-2 text-xs text-slate-500">{editForm.facePhotoUrls.length}/4 attendance face photos selected.</p>
                  </div>
                </div>
                <div className="mt-5 flex flex-wrap gap-2">
                  <button onClick={() => updateMutation.mutate()} disabled={updateMutation.isPending} className="rounded-xl bg-violet-600 px-5 py-2 text-sm font-bold text-white disabled:opacity-50">
                    {updateMutation.isPending ? 'Saving...' : 'Save all changes'}
                  </button>
                  <button type="button" onClick={() => setEditMode(false)} className="rounded-xl border border-slate-200 px-5 py-2 text-sm font-bold text-slate-700">
                    Cancel
                  </button>
                </div>
              </section>
            )}

            {tab === 'profile' && (
              <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <h2 className="mb-4 text-lg font-bold text-slate-950">Profile</h2>
                <div className="grid gap-4 md:grid-cols-3">
                  <InfoRow label="Admission date" value={formatDate(student.admissionDate)} />
                  <InfoRow label="Date of birth" value={formatDate(student.dob)} />
                  <InfoRow label="Type" value={student.category ?? 'Regular'} />
                  <InfoRow label="Religion" value={student.religion} />
                  <InfoRow label="Phone number" value={student.phone ?? student.parentPhone} />
                  <InfoRow label="Email address" value={student.email ?? student.parentEmail} />
                </div>
                <div className="mt-4 grid gap-4 md:grid-cols-2">
                  <InfoRow label="Present address" value={student.presentAddress ?? student.addressLine1} />
                  <InfoRow label="Permanent address" value={student.permanentAddress ?? student.addressLine2} />
                </div>
                <h3 className="mt-6 text-base font-bold text-slate-950">Sibling Information</h3>
                <div className="mt-3 grid gap-3 md:grid-cols-2">
                  {student.siblings?.length ? student.siblings.map((item) => (
                    <div key={item.sibling.id} className="rounded-xl border border-slate-100 p-3">
                      <p className="font-semibold text-slate-900">{item.sibling.fullName}</p>
                      <p className="text-sm text-slate-500">{item.sibling.class?.name ?? '-'} {item.sibling.section?.name ?? ''}</p>
                    </div>
                  )) : <p className="text-sm text-slate-500">No sibling linked.</p>}
                </div>
              </section>
            )}

            {tab === 'parents' && (
              <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <h2 className="mb-4 text-lg font-bold text-slate-950">Parents & Guardians</h2>
                <div className="grid gap-4 md:grid-cols-3">
                  <InfoRow label="Father name" value={student.fatherName} />
                  <InfoRow label="Father phone" value={student.fatherPhone} />
                  <InfoRow label="Father occupation" value={student.fatherOccupation} />
                  <InfoRow label="Mother name" value={student.motherName} />
                  <InfoRow label="Mother phone" value={student.motherPhone} />
                  <InfoRow label="Mother occupation" value={student.motherOccupation} />
                  <InfoRow label="Guardian name" value={student.guardianName} />
                  <InfoRow label="Guardian relationship" value={student.guardianRelationship} />
                  <InfoRow label="Parent email" value={student.parentEmail} />
                </div>
                <h3 className="mt-6 text-base font-bold text-slate-950">Linked Parent Accounts</h3>
                <div className="mt-3 grid gap-3 md:grid-cols-2">
                  {student.parentLinks?.length ? student.parentLinks.map((link) => (
                    <div key={link.parentId} className="rounded-xl border border-slate-100 bg-slate-50 p-4">
                      {parentAccountEdit?.id === link.parentId ? (
                        <div className="space-y-3">
                          <div className="grid gap-3 sm:grid-cols-2">
                            <input value={parentAccountEdit.firstName} onChange={(event) => setParentAccountEdit({ ...parentAccountEdit, firstName: event.target.value })} placeholder="First name" className={inputClass} />
                            <input value={parentAccountEdit.lastName} onChange={(event) => setParentAccountEdit({ ...parentAccountEdit, lastName: event.target.value })} placeholder="Last name" className={inputClass} />
                            <input value={parentAccountEdit.phone} onChange={(event) => setParentAccountEdit({ ...parentAccountEdit, phone: event.target.value })} placeholder="Phone" className={inputClass} />
                            <input type="email" value={parentAccountEdit.email} onChange={(event) => setParentAccountEdit({ ...parentAccountEdit, email: event.target.value })} placeholder="Email" className={inputClass} />
                          </div>
                          <div className="flex flex-wrap gap-2">
                            <button onClick={() => updateParentMutation.mutate()} disabled={updateParentMutation.isPending} className="rounded-lg bg-violet-600 px-3 py-2 text-xs font-bold text-white disabled:opacity-50">
                              {updateParentMutation.isPending ? 'Saving...' : 'Save parent'}
                            </button>
                            <button onClick={() => setParentAccountEdit(null)} className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-bold text-slate-700">Cancel</button>
                          </div>
                        </div>
                      ) : (
                        <>
                          <p className="font-bold text-slate-950">{link.parent.firstName} {link.parent.lastName}</p>
                          <p className="mt-1 text-sm text-slate-600">{link.parent.phone ?? 'No phone'}</p>
                          <p className="text-sm text-slate-600">{link.parent.email ?? 'No email'}</p>
                          {canEditStudent ? (
                            <div className="mt-4 flex flex-wrap gap-2">
                              <button
                                onClick={() => setParentAccountEdit({
                                  id: link.parentId,
                                  firstName: link.parent.firstName,
                                  lastName: link.parent.lastName,
                                  phone: link.parent.phone ?? '',
                                  email: link.parent.email ?? '',
                                })}
                                className="rounded-lg border border-violet-200 bg-violet-50 px-3 py-2 text-xs font-bold text-violet-700"
                              >
                                Edit account
                              </button>
                              <button
                                onClick={() => window.confirm('Unlink this parent account from the student?') && unlinkParentMutation.mutate(link.parentId)}
                                disabled={unlinkParentMutation.isPending}
                                className="rounded-lg border border-red-200 px-3 py-2 text-xs font-bold text-red-600 disabled:opacity-50"
                              >
                                Unlink
                              </button>
                            </div>
                          ) : null}
                        </>
                      )}
                    </div>
                  )) : <p className="rounded-xl border border-dashed border-slate-200 p-6 text-sm text-slate-500">No parent login account is linked.</p>}
                </div>
                <h3 className="mt-6 text-base font-bold text-slate-950">Guardian Records</h3>
                <div className="mt-3 grid gap-3 md:grid-cols-2">
                  {student.guardians?.length ? student.guardians.map((guardian) => (
                    <div key={guardian.id} className="rounded-xl border border-slate-100 p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="font-bold text-slate-950">{guardian.name}</p>
                          <p className="text-xs font-semibold uppercase text-violet-600">{guardian.type}{guardian.isPrimary ? ' - Primary' : ''}</p>
                        </div>
                        {guardian.relation ? <span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-bold text-slate-600">{guardian.relation}</span> : null}
                      </div>
                      <div className="mt-3 grid gap-2 text-sm text-slate-600">
                        <p>Phone: {guardian.phone ?? '-'}</p>
                        <p>Email: {guardian.email ?? '-'}</p>
                        <p>Occupation: {guardian.occupation ?? '-'}</p>
                      </div>
                    </div>
                  )) : <p className="rounded-xl border border-dashed border-slate-200 p-6 text-sm text-slate-500">No additional guardian records found.</p>}
                </div>
              </section>
            )}

            {tab === 'fees' && (
              <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                  <h2 className="text-lg font-bold text-slate-950">Fees</h2>
                  <div className="flex flex-wrap gap-2">
                    <Link href={`/dashboard/fees?studentId=${student.id}`} className="rounded-xl border border-slate-200 px-3 py-2 text-sm font-bold text-slate-700">
                      Manage fee setup
                    </Link>
                    <Link href={`/dashboard/fees/collection?studentId=${student.id}`} className="rounded-xl border border-violet-200 bg-violet-50 px-3 py-2 text-sm font-bold text-violet-700">
                      Open fee collection
                    </Link>
                  </div>
                </div>
                {feeInvoicesQuery.isLoading ? (
                  <div className="rounded-xl border border-dashed border-slate-200 p-8 text-center text-sm text-slate-500">Loading fee details...</div>
                ) : feeInvoicesQuery.isError ? (
                  <div className="rounded-xl border border-amber-200 bg-amber-50 p-6 text-sm font-semibold text-amber-800">Unable to load fee details. Check whether Fees &rarr; Invoices access is enabled for this role in the subscription plan.</div>
                ) : (
                  <>
                    <div className="grid gap-3 sm:grid-cols-4">
                      <InfoRow label="Total billed" value={toMoney(sumInvoiceField(feeInvoices, 'totalAmount'))} />
                      <InfoRow label="Discount" value={toMoney(sumInvoiceField(feeInvoices, 'discountAmount'))} />
                      <InfoRow label="Paid" value={toMoney(sumInvoiceField(feeInvoices, 'paidAmount'))} />
                      <InfoRow label="Balance due" value={toMoney(sumInvoiceField(feeInvoices, 'dueAmount'))} />
                    </div>

                    {/* Invoice + payment history */}
                    <div className="mt-6 space-y-4">
                      {feeInvoices.length ? feeInvoices.map((invoice) => {
                        const statusColors: Record<string, string> = {
                          PAID: 'bg-emerald-100 text-emerald-700',
                          PARTIALLY_PAID: 'bg-amber-100 text-amber-700',
                          OVERDUE: 'bg-red-100 text-red-700',
                          ISSUED: 'bg-blue-100 text-blue-700',
                          DRAFT: 'bg-slate-100 text-slate-600',
                          CANCELLED: 'bg-slate-100 text-slate-400 line-through',
                        };
                        const payments = invoice.payments ?? [];
                        const isPast = invoice.dueDate ? new Date(invoice.dueDate) < new Date() : false;
                        const isUpcoming = !isPast && invoice.status !== 'PAID' && invoice.status !== 'CANCELLED';
                        return (
                          <div key={invoice.id} className="overflow-hidden rounded-xl border border-slate-200">
                            {/* Invoice header */}
                            <div className="flex flex-wrap items-center justify-between gap-2 bg-slate-50 px-4 py-3">
                              <div>
                                <p className="font-bold text-slate-900">
                                  {invoice.feeType?.name ?? invoice.invoiceNumber}
                                  {invoice.feeMonth ? <span className="ml-2 text-xs font-normal text-slate-500">({invoice.feeMonth})</span> : null}
                                </p>
                                <p className="text-xs text-slate-400">{invoice.invoiceNumber}</p>
                              </div>
                              <div className="flex flex-wrap items-center gap-2 text-sm">
                                {isUpcoming && (
                                  <span className="rounded-full bg-violet-100 px-2 py-0.5 text-xs font-bold text-violet-700">Upcoming</span>
                                )}
                                <span className={`rounded-full px-2 py-0.5 text-xs font-bold ${statusColors[invoice.status] ?? 'bg-slate-100 text-slate-600'}`}>
                                  {invoice.status.replace(/_/g, ' ')}
                                </span>
                                <span className="text-xs text-slate-500">Due {formatDate(invoice.dueDate)}</span>
                              </div>
                            </div>

                            {/* Invoice amounts */}
                            <div className="grid grid-cols-2 divide-x divide-slate-100 border-b border-slate-100 sm:grid-cols-4">
                              {[
                                { label: 'Billed', value: toMoney(invoice.totalAmount) },
                                { label: 'Discount', value: toMoney(invoice.discountAmount), className: 'text-emerald-700' },
                                { label: 'Paid', value: toMoney(invoice.paidAmount), className: 'text-slate-900 font-bold' },
                                { label: 'Balance', value: toMoney(invoice.dueAmount), className: Number(invoice.dueAmount) > 0 ? 'text-red-600 font-bold' : 'text-slate-400' },
                              ].map((cell) => (
                                <div key={cell.label} className="px-4 py-2">
                                  <p className="text-xs font-semibold uppercase text-slate-400">{cell.label}</p>
                                  <p className={`text-sm ${cell.className ?? 'text-slate-700'}`}>{cell.value}</p>
                                </div>
                              ))}
                            </div>

                            {/* Payment history rows */}
                            {payments.length > 0 ? (
                              <div className="divide-y divide-slate-100">
                                {payments.map((payment) => (
                                  <div key={payment.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3">
                                    <div className="flex items-center gap-3">
                                      <div className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-emerald-100 text-emerald-700">
                                        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                        </svg>
                                      </div>
                                      <div>
                                        <p className="text-sm font-semibold text-slate-900">{payment.paymentNumber}</p>
                                        <p className="text-xs text-slate-500">{payment.paymentMode.replace(/_/g, ' ')} &middot; {formatDate(payment.paidAt)}</p>
                                      </div>
                                    </div>
                                    <div className="text-right">
                                      <p className="text-sm font-bold text-emerald-700">+{toMoney(payment.amount)}</p>
                                      {payment.receipt?.receiptNumber ? (
                                        <p className="text-xs text-slate-400">Receipt {payment.receipt.receiptNumber}</p>
                                      ) : null}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <p className="px-4 py-3 text-xs text-slate-400">No payments recorded yet.</p>
                            )}
                          </div>
                        );
                      }) : (
                        <div className="rounded-xl border border-dashed border-slate-200 p-8 text-center text-sm text-slate-500">No fee invoices found for this student.</div>
                      )}
                    </div>
                  </>
                )}
              </section>
            )}

            {tab === 'transport' && (
              <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                  <h2 className="text-lg font-bold text-slate-950">Transport</h2>
                  <Link href={`/dashboard/transport?studentId=${student.id}`} className="rounded-xl border border-violet-200 bg-violet-50 px-3 py-2 text-sm font-bold text-violet-700">
                    Manage transport
                  </Link>
                </div>
                {transportQuery.isLoading ? (
                  <div className="rounded-xl border border-dashed border-slate-200 p-8 text-center text-sm text-slate-500">Loading transport assignment...</div>
                ) : transportQuery.isError ? (
                  <div className="rounded-xl border border-amber-200 bg-amber-50 p-6 text-sm font-semibold text-amber-800">Unable to load transport details. Check whether Transport access is enabled for this role.</div>
                ) : transportAssignments.length ? (
                  <div className="grid gap-3 md:grid-cols-2">
                    {transportAssignments.map((assignment) => (
                      <div key={assignment.id} className="rounded-xl border border-slate-100 p-4">
                        <div className="flex items-start justify-between gap-3">
                          <p className="font-bold text-slate-950">{assignment.route.title}</p>
                          <span className={`rounded-full px-2 py-1 text-xs font-bold ${assignment.active ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600'}`}>{assignment.active ? 'Active' : 'Inactive'}</span>
                        </div>
                        <div className="mt-3 grid gap-2 md:grid-cols-2">
                          <InfoRow label="Fare" value={toMoney(assignment.route.fare)} />
                          <InfoRow label="Vehicle" value={assignment.vehicle?.vehicleNumber} />
                          <InfoRow label="Driver" value={assignment.vehicle?.driverName} />
                          <InfoRow label="Driver contact" value={assignment.vehicle?.driverContact} />
                        </div>
                        {assignment.note ? <p className="mt-3 text-sm text-slate-600">{assignment.note}</p> : null}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="rounded-xl border border-dashed border-slate-200 p-8 text-center text-sm text-slate-500">This student is not assigned to transport.</div>
                )}
              </section>
            )}

            {tab === 'library' && (
              <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                  <h2 className="text-lg font-bold text-slate-950">Library</h2>
                  <Link href={`/dashboard/library?studentId=${student.id}`} className="rounded-xl border border-violet-200 bg-violet-50 px-3 py-2 text-sm font-bold text-violet-700">
                    Manage library
                  </Link>
                </div>
                {libraryMembersQuery.isLoading || libraryIssuesQuery.isLoading ? (
                  <div className="rounded-xl border border-dashed border-slate-200 p-8 text-center text-sm text-slate-500">Loading library details...</div>
                ) : libraryMembersQuery.isError || libraryIssuesQuery.isError ? (
                  <div className="rounded-xl border border-amber-200 bg-amber-50 p-6 text-sm font-semibold text-amber-800">Unable to load library details. Check whether Library access is enabled for this role.</div>
                ) : libraryMember ? (
                  <>
	                    <div className="grid gap-3 md:grid-cols-4">
	                      <InfoRow label="Member code" value={libraryMember.memberCode} />
	                      <InfoRow label="Member status" value={libraryMember.active ? 'Active' : 'Inactive'} />
	                      <InfoRow label="Phone" value={libraryMember.phone} />
	                      <InfoRow label="Issued books" value={libraryIssues.length} />
	                    </div>
	                    {canEditStudent ? (
	                      <div className="mt-4 flex flex-wrap gap-2">
	                        <button
	                          onClick={() => window.confirm('Cancel this library membership?') && cancelLibraryMemberMutation.mutate(libraryMember.id)}
	                          disabled={cancelLibraryMemberMutation.isPending || libraryIssues.some((issue) => issue.status === 'ISSUED')}
	                          className="rounded-xl border border-red-200 px-3 py-2 text-sm font-bold text-red-600 disabled:cursor-not-allowed disabled:opacity-50"
	                        >
	                          Cancel membership
	                        </button>
	                        {libraryIssues.some((issue) => issue.status === 'ISSUED') ? (
	                          <span className="self-center text-xs font-semibold text-slate-500">Return issued books before cancelling membership.</span>
	                        ) : null}
	                      </div>
	                    ) : null}
	                    <div className="mt-5 overflow-x-auto rounded-xl border border-slate-100">
	                      <table className="min-w-full text-left text-sm">
	                        <thead className="bg-slate-50 text-xs uppercase text-slate-500">
	                          <tr><th className="px-3 py-2">Book</th><th className="px-3 py-2">Book No</th><th className="px-3 py-2">Issue Date</th><th className="px-3 py-2">Return Date</th><th className="px-3 py-2">Status</th><th className="px-3 py-2">Action</th></tr>
	                        </thead>
	                        <tbody>
	                          {libraryIssues.length ? libraryIssues.map((issue) => (
	                            <tr key={issue.id} className="border-b border-slate-100">
	                              <td className="px-3 py-2 font-semibold text-slate-900">{issue.book?.title ?? '-'}</td>
	                              <td className="px-3 py-2">{issue.book?.bookNumber ?? '-'}</td>
	                              <td className="px-3 py-2">{formatDate(issue.issueDate)}</td>
	                              <td className="px-3 py-2">{formatDate(issue.returnDate ?? issue.returnedAt)}</td>
	                              <td className="px-3 py-2">{issue.status}</td>
	                              <td className="px-3 py-2">
	                                {canEditStudent && issue.status === 'ISSUED' ? (
	                                  <button
	                                    onClick={() => returnLibraryIssueMutation.mutate(issue.id)}
	                                    disabled={returnLibraryIssueMutation.isPending}
	                                    className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-bold text-emerald-700 disabled:opacity-50"
	                                  >
	                                    Return
	                                  </button>
	                                ) : '-'}
	                              </td>
	                            </tr>
	                          )) : <tr><td colSpan={6} className="px-3 py-8 text-center text-slate-500">No library issues found for this student.</td></tr>}
	                        </tbody>
	                      </table>
	                    </div>
	                  </>
	                ) : (
	                  <div className="rounded-xl border border-dashed border-slate-200 p-8 text-center text-sm text-slate-500">
	                    <p>This student is not registered as a library member.</p>
	                    {canEditStudent ? (
	                      <button
	                        onClick={() => createLibraryMemberMutation.mutate()}
	                        disabled={createLibraryMemberMutation.isPending}
	                        className="mt-4 rounded-xl bg-violet-600 px-4 py-2 text-sm font-bold text-white disabled:opacity-50"
	                      >
	                        {createLibraryMemberMutation.isPending ? 'Registering...' : 'Register library member'}
	                      </button>
	                    ) : null}
	                  </div>
	                )}
              </section>
            )}

            {tab === 'dormitory' && (
              <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <h2 className="mb-4 text-lg font-bold text-slate-950">Dormitory</h2>
                {dormitoryQuery.isLoading ? (
                  <div className="rounded-xl border border-dashed border-slate-200 p-8 text-center text-sm text-slate-500">Loading dormitory assignment...</div>
                ) : dormitoryQuery.isError ? (
                  <div className="rounded-xl border border-amber-200 bg-amber-50 p-6 text-sm font-semibold text-amber-800">Unable to load dormitory details. Check whether Dormitory access is enabled for this role.</div>
                ) : dormitoryAssignments.length ? (
                  <div className="grid gap-3 md:grid-cols-2">
                    {dormitoryAssignments.map((assignment) => (
                      <div key={assignment.id} className="rounded-xl border border-slate-100 p-4">
                        <div className="flex items-start justify-between gap-3">
                          <p className="font-bold text-slate-950">{assignment.dormitory.name}</p>
                          <span className={`rounded-full px-2 py-1 text-xs font-bold ${assignment.active ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600'}`}>{assignment.active ? 'Active' : 'Inactive'}</span>
                        </div>
                        <div className="mt-3 grid gap-2 md:grid-cols-2">
                          <InfoRow label="Room" value={assignment.room?.roomNumber} />
                          <InfoRow label="Room type" value={assignment.room?.roomType?.name} />
                          <InfoRow label="Beds" value={assignment.room?.bedCount} />
                          <InfoRow label="Cost per bed" value={toMoney(assignment.room?.costPerBed)} />
                        </div>
                        {assignment.note ? <p className="mt-3 text-sm text-slate-600">{assignment.note}</p> : null}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="rounded-xl border border-dashed border-slate-200 p-8 text-center text-sm text-slate-500">This student is not assigned to a dormitory.</div>
                )}
              </section>
            )}

            {tab === 'exam' && (
              <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <h2 className="mb-4 text-lg font-bold text-slate-950">Exam Results</h2>
                {examGroups.length ? (
                  <div className="space-y-6">
                    {examGroups.map((exam) => (
                      <div key={exam.id} className="overflow-hidden rounded-xl border border-slate-200">
                        <div className="border-b border-slate-200 bg-slate-100 px-4 py-3 text-lg font-bold text-slate-950">
                          {exam.name}
                        </div>
                        <div className="overflow-x-auto">
                          <table className="min-w-full text-left text-sm">
                            <thead className="bg-white text-xs uppercase text-slate-500">
                              <tr>
                                <th className="px-3 py-3">Subject</th>
                                <th className="px-3 py-3">Max Marks</th>
                                <th className="px-3 py-3">Min Marks</th>
                                <th className="px-3 py-3">Marks Obtained</th>
                                <th className="px-3 py-3">Result</th>
                                <th className="px-3 py-3">Grade</th>
                                <th className="px-3 py-3">Note</th>
                              </tr>
                            </thead>
                            <tbody>
                              {exam.marks.map((mark) => {
                                const subjectName = mark.examPaper?.subject?.name ?? '-';
                                const subjectCode = mark.examPaper?.subject?.code;
                                const passed = isPassingMark(mark);
                                return (
                                  <tr key={mark.id} className="border-t border-slate-100">
                                    <td className="px-3 py-3 font-semibold text-slate-900">
                                      {subjectName}{subjectCode ? ` (${subjectCode})` : ''}
                                    </td>
                                    <td className="px-3 py-3">{formatMark(mark.examPaper?.maxMarks)}</td>
                                    <td className="px-3 py-3">{formatMark(mark.examPaper?.passMarks)}</td>
                                    <td className="px-3 py-3 font-bold text-slate-950">{formatMark(mark.marks)}</td>
                                    <td className="px-3 py-3">
                                      <span className={`rounded-md px-2 py-1 text-xs font-bold ${passed ? 'bg-emerald-500 text-white' : 'bg-red-500 text-white'}`}>
                                        {passed ? 'Pass' : 'Fail'}
                                      </span>
                                    </td>
                                    <td className="px-3 py-3">{mark.grade ?? '-'}</td>
                                    <td className="px-3 py-3">{mark.status ?? '-'}</td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                        <div className="grid gap-3 bg-slate-100 px-4 py-4 text-sm font-bold text-slate-950 md:grid-cols-2 xl:grid-cols-6">
                          <div>Grand Total : {formatMark(exam.grandTotal, 0)}</div>
                          <div>Total Obtain Marks : {formatMark(exam.totalObtained, 0)}</div>
                          <div>Percentage : {formatMark(exam.percentage, 2)}</div>
                          <div>Rank : -</div>
                          <div>
                            Result :
                            <span className={`ml-2 rounded-md px-2 py-1 text-xs font-bold ${exam.result === 'Pass' ? 'bg-emerald-500 text-white' : 'bg-red-500 text-white'}`}>
                              {exam.result}
                            </span>
                          </div>
                          <div>Division : {exam.division}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="rounded-xl border border-dashed border-slate-200 p-8 text-center text-sm text-slate-500">
                    No exam results found.
                  </div>
                )}
              </section>
            )}

            {tab === 'documents' && (
              <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <h2 className="mb-4 text-lg font-bold text-slate-950">Documents</h2>
                {canCreateDocument ? <div className="mb-5 grid gap-3 md:grid-cols-[1fr_1fr_auto]">
                  <input value={documentForm.title} onChange={(event) => setDocumentForm({ ...documentForm, title: event.target.value })} placeholder="Document title" className="rounded-xl border border-slate-200 px-3 py-2 text-sm" />
                  <input type="file" accept=".pdf,.doc,.docx,image/*" onChange={(event) => setDocumentForm({ ...documentForm, file: event.target.files?.[0] ?? null })} className="rounded-xl border border-slate-200 px-3 py-2 text-sm" />
                  <button onClick={() => documentMutation.mutate()} disabled={documentMutation.isPending} className="rounded-xl bg-violet-600 px-4 py-2 text-sm font-bold text-white disabled:opacity-50">Upload</button>
                </div> : null}
                <div className="grid gap-3">
                  {student.documents?.length ? student.documents.map((document) => (
                    <div key={document.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-100 p-3">
                      <div>
                        <p className="font-semibold text-slate-900">{document.title}</p>
                        <p className="text-xs text-slate-500">{formatDate(document.createdAt)}</p>
                      </div>
                      <div className="flex gap-2">
                        <a href={resolveUploadUrl(document.url, { type: 'student-document', id: document.id }) ?? undefined} target="_blank" rel="noreferrer" className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700">Download</a>
                        {canDeleteDocument ? <button onClick={() => window.confirm('Delete this document?') && deleteDocumentMutation.mutate(document.id)} className="rounded-lg border border-red-200 px-3 py-2 text-sm font-semibold text-red-600">Delete</button> : null}
                      </div>
                    </div>
                  )) : <p className="rounded-xl border border-dashed border-slate-200 p-8 text-center text-sm text-slate-500">No documents uploaded.</p>}
                </div>
              </section>
            )}

            {tab === 'timeline' && (
              <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <h2 className="mb-4 text-lg font-bold text-slate-950">Timeline</h2>
                {canCreateTimeline ? <div className="mb-5 grid gap-3 md:grid-cols-[1fr_160px_auto]">
                  <input value={timelineForm.title} onChange={(event) => setTimelineForm({ ...timelineForm, title: event.target.value })} placeholder="Title" className="rounded-xl border border-slate-200 px-3 py-2 text-sm" />
                  <input type="date" value={timelineForm.timelineDate} onChange={(event) => setTimelineForm({ ...timelineForm, timelineDate: event.target.value })} className="rounded-xl border border-slate-200 px-3 py-2 text-sm" />
                  <button onClick={() => timelineMutation.mutate()} disabled={timelineMutation.isPending} className="rounded-xl bg-violet-600 px-4 py-2 text-sm font-bold text-white disabled:opacity-50">Add</button>
                  <textarea value={timelineForm.description} onChange={(event) => setTimelineForm({ ...timelineForm, description: event.target.value })} placeholder="Description" className="rounded-xl border border-slate-200 px-3 py-2 text-sm md:col-span-3" />
                </div> : null}
                <div className="space-y-3">
                  {student.timelines?.length ? student.timelines.map((item) => (
                    <div key={item.id} className="rounded-xl border border-slate-100 p-4">
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <p className="font-bold text-slate-950">{item.title}</p>
                          <p className="text-xs font-semibold uppercase text-violet-600">{formatDate(item.timelineDate)}</p>
                          <p className="mt-2 text-sm text-slate-600">{item.description || '-'}</p>
                        </div>
                        {canDeleteTimeline ? <button onClick={() => window.confirm('Delete this timeline item?') && deleteTimelineMutation.mutate(item.id)} className="rounded-lg border border-red-200 px-3 py-2 text-sm font-semibold text-red-600">
                          <Icon path="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6M9 7h6" />
                        </button> : null}
                      </div>
                    </div>
                  )) : <p className="rounded-xl border border-dashed border-slate-200 p-8 text-center text-sm text-slate-500">No timeline items found.</p>}
                </div>
              </section>
            )}
          </main>
        </div>
      </div>
    </div>
  );
}
