import assert from 'node:assert/strict';
import test from 'node:test';
import { HttpError } from '../../../../middlewares/error.middleware';
import { buildFeeReport, parseFeeReportQuery } from '../fee-report.service';

const scope = {
  schoolId: '11111111-1111-4111-8111-111111111111',
  academicSessionId: '22222222-2222-4222-8222-222222222222',
};

test('parseFeeReportQuery preserves existing default report type', () => {
  const query = parseFeeReportQuery({});

  assert.equal(query.type, 'daily_collection');
});

test('buildFeeReport rejects inverted date ranges before querying data', async () => {
  const query = parseFeeReportQuery({
    dateFrom: '2026-06-10',
    dateTo: '2026-06-01',
  });

  await assert.rejects(
    () => buildFeeReport(scope, query),
    (error) => error instanceof HttpError && error.statusCode === 400 && error.message === 'dateTo cannot be before dateFrom',
  );
});
