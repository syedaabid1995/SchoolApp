'use client';

import { useParams } from 'next/navigation';
import FeesWorkspace, { type FeeSectionId } from '../FeesWorkspace';

const feeSectionIds: FeeSectionId[] = [
  'overview',
  'particulars',
  'types',
  'structures',
  'assignments',
  'invoice-generate',
  'invoices',
  'collection',
  'discounts',
  'fines',
  'ledger',
  'reports',
];

export default function FeeSectionPage() {
  const params = useParams();
  const candidate = typeof params.section === 'string' ? params.section : '';
  const initialSection = candidate === 'setup' ? 'particulars' : feeSectionIds.includes(candidate as FeeSectionId) ? (candidate as FeeSectionId) : 'overview';

  return <FeesWorkspace initialSection={initialSection} />;
}
