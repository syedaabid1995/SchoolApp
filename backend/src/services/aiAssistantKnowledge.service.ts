const knowledge = [
  {
    keywords: ['exam', 'create exam', 'assessment'],
    answer:
      'To create an exam, go to Examination > Exams, choose exam type, academic year, class, section, exam date, then map assigned subjects. Subjects must already be assigned in Academic Setup > Assign Subjects.',
  },
  {
    keywords: ['hall ticket', 'hall tickets'],
    answer:
      'Hall tickets require an exam, students in the selected class/section, an exam center, exam rooms with capacity, and generated seating. After seating is generated, open Examination > Hall Tickets to view or download PDFs.',
  },
  {
    keywords: ['marks', 'marks entry', 'upload marks'],
    answer:
      'Before marks entry, create an exam with papers, ensure the class/section has students, then open Examination > Marks, select academic year, exam, class, section, and subject.',
  },
  {
    keywords: ['login', 'school code'],
    answer:
      'School users sign in from the school-code URL or by selecting their school code on login. The backend derives tenant scope from authenticated session and school context.',
  },
  {
    keywords: ['onboarding', 'pending setup', 'setup pending'],
    answer:
      'School onboarding checks core setup such as academic year, classes, sections, subjects, students, teachers, assignments, and operational readiness.',
  },
  {
    keywords: ['attendance'],
    answer:
      'Attendance depends on academic year, class, section, enrolled students, and attendance mode. School admins can configure attendance mode and periods from academic/system setup.',
  },
  {
    keywords: ['backup', 'restore'],
    answer:
      'Backup and restore are high-risk operational workflows. This AI assistant can explain them, but it cannot execute backup or restore actions.',
  },
  {
    keywords: ['compliance', 'approval', 'deletion request', 'export request'],
    answer:
      'Compliance workflows are controlled review flows. This assistant can explain where to review them, but it cannot approve, reject, or execute compliance actions.',
  },
];

export const answerProductQuestion = (message: string) => {
  const lower = message.toLowerCase();
  const match = knowledge.find((item) => item.keywords.some((keyword) => lower.includes(keyword)));
  if (match) return match.answer;
  return 'I can help with school onboarding, academic setup, students, teachers, timetable, attendance, exams, reports, compliance, and backup guidance. I cannot perform unsupported or high-risk actions yet.';
};

export const explainNextSetupStep = async (params: {
  classes: number;
  sections: number;
  subjects: number;
  teachers: number;
  students: number;
}) => {
  if (params.classes === 0) return 'Start by creating classes in Academic Setup.';
  if (params.sections === 0) return 'Create sections, then assign them to classes.';
  if (params.subjects === 0) return 'Create subjects and assign them to class sections.';
  if (params.teachers === 0) return 'Add teacher profiles before assigning subjects.';
  if (params.students === 0) return 'Add students to the configured classes and sections.';
  return 'Core setup is present. Next, verify subject assignments, timetable, and exam readiness.';
};

export const navigationForTopic = (message: string) => {
  const lower = message.toLowerCase();
  if (lower.includes('exam')) return { label: 'Exams', path: '/dashboard/academics/exams' };
  if (lower.includes('marks')) return { label: 'Marks', path: '/dashboard/academics/marks' };
  if (lower.includes('student')) return { label: 'Students', path: '/dashboard/students' };
  if (lower.includes('teacher') || lower.includes('staff')) return { label: 'Employees', path: '/dashboard/staff' };
  if (lower.includes('attendance')) return { label: 'Attendance', path: '/dashboard/attendance' };
  if (lower.includes('report')) return { label: 'Reports', path: '/dashboard/reports' };
  if (lower.includes('class') || lower.includes('section') || lower.includes('subject')) {
    return { label: 'Academic Setup', path: '/dashboard/academics' };
  }
  return { label: 'Dashboard', path: '/dashboard' };
};
