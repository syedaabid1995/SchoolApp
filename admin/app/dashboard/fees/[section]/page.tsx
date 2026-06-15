'use client';

import { useParams } from 'next/navigation';
import FeesWorkspace, { type FeeSectionId } from '../FeesWorkspace';

const feeSectionIds: FeeSectionId[] = [
  'overview',
  'groups',
  'types',
  'masters',
  'collection',
  'discounts',
  'reports',
];

export default function FeeSectionPage() {
  const params = useParams();
  const candidate = typeof params.section === 'string' ? params.section : '';
  const initialSection = feeSectionIds.includes(candidate as FeeSectionId) ? (candidate as FeeSectionId) : 'overview';

  return <FeesWorkspace initialSection={initialSection} />;
}
