import { HttpError } from '../middlewares/error.middleware';

export type GradeScale = {
  min: number;
  max: number;
  grade: string;
};

const defaultScale: GradeScale[] = [
  { min: 90, max: 100, grade: 'A+' },
  { min: 80, max: 89.99, grade: 'A' },
  { min: 70, max: 79.99, grade: 'B' },
  { min: 60, max: 69.99, grade: 'C' },
  { min: 50, max: 59.99, grade: 'D' },
  { min: 0, max: 49.99, grade: 'F' },
];

export const calculateGrade = (score: number, maxMarks: number, scale = defaultScale) => {
  if (maxMarks <= 0) {
    throw new HttpError(400, 'Invalid max marks');
  }

  const percentage = (score / maxMarks) * 100;
  const grade = scale.find((item) => percentage >= item.min && percentage <= item.max);
  return grade ? grade.grade : 'F';
};
