import assert from 'node:assert/strict';
import test from 'node:test';
import * as core from '../fee-management.core';
import * as facade from '../fee-management.service';

const feeRouteHandlers = [
  'activateFeeAssignment',
  'activateFeeDiscount',
  'approveFeeDiscount',
  'assignStudentFees',
  'cancelFeeInvoice',
  'collectFeePayment',
  'createFeeDiscount',
  'createFeeFine',
  'createFeeParticular',
  'createFeeStructure',
  'createFeeType',
  'deactivateFeeAssignment',
  'deactivateFeeDiscount',
  'deleteFeeAssignment',
  'deleteFeeDiscount',
  'deleteFeeFine',
  'deleteFeeParticular',
  'deleteFeeStructure',
  'deleteFeeType',
  'duplicateFeeStructure',
  'exportFeeLedgerExcel',
  'exportFeeLedgerPdf',
  'exportFeeReports',
  'generateFeeInvoices',
  'getFeeMetadata',
  'getFeeReports',
  'getStudentFeeLedger',
  'listFeeAssignments',
  'listFeeDiscounts',
  'listFeeFines',
  'listFeeInvoices',
  'listFeeParticulars',
  'listFeePayments',
  'listFeeStructures',
  'listFeeTypes',
  'listStudentCollectionInvoices',
  'previewFeeInvoices',
  'rejectFeeDiscount',
  'searchFeeCollectionStudents',
  'updateFeeAssignment',
  'updateFeeDiscount',
  'updateFeeParticular',
  'updateFeeStructure',
  'updateFeeType',
] as const;

test('fee management facade preserves the existing route handler export surface', () => {
  for (const handlerName of feeRouteHandlers) {
    assert.equal(typeof facade[handlerName], 'function', `${handlerName} should be exported by the fee facade`);
    assert.equal(facade[handlerName], core[handlerName], `${handlerName} should delegate to the existing implementation`);
  }
});
