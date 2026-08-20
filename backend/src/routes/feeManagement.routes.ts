import { Router } from 'express';
import {
  assignStudentFees,
  activateFeeDiscount,
  activateFeeAssignment,
  cancelFeeInvoice,
  cancelFeeCarryForward,
  collectFeePayment,
  approveFeeDiscount,
  createFeeCarryForward,
  createFeeDiscount,
  createFeeFine,
  createFeeFineRule,
  createFeeGroup,
  createFeeMaster,
  createFeeParticular,
  createFeeStructure,
  createFeeType,
  deactivateFeeDiscount,
  deactivateFeeAssignment,
  deleteFeeAssignment,
  deleteFeeDiscount,
  deleteFeeFine,
  deleteFeeFineRule,
  deleteFeeGroup,
  deleteFeeMaster,
  deleteFeeParticular,
  deleteFeeStructure,
  deleteFeeType,
  duplicateFeeMaster,
  duplicateFeeStructure,
  exportFeeLedgerExcel,
  exportFeeLedgerPdf,
  exportFeeReports,
  generateFeeInvoices,
  generateCarryForwardInvoice,
  getFeeMetadata,
  getFeeReports,
  getStudentFeeLedger,
  listStudentCollectionInvoices,
  listFeeAssignments,
  listFeeCarryForwards,
  listFeeDiscounts,
  listFeeFineRules,
  listFeeFines,
  listFeeGroups,
  listFeeInvoices,
  listFeeMasters,
  listFeeParticulars,
  listFeePayments,
  listFeeStructures,
  listFeeTypes,
  previewFeeInvoices,
  previewFeeCarryForward,
  notifyStudentFeePayment,
  reverseFeePayment,
  searchFeeCollectionStudents,
  rejectFeeDiscount,
  updateFeeAssignment,
  updateFeeParticular,
  updateFeeDiscount,
  updateFeeFineRule,
  updateFeeGroup,
  updateFeeMaster,
  updateFeeStructure,
  updateFeeType,
} from '../controllers/feeManagement.controller';
import { authMiddleware } from '../middlewares/auth.middleware';
import { requireModuleFeatureEnabled } from '../middlewares/feature-flag.middleware';
import { blockSuperAdminSchoolOperations } from '../middlewares/rbac.middleware';

export const feeManagementRouter = Router();

feeManagementRouter.use(authMiddleware);
feeManagementRouter.use(blockSuperAdminSchoolOperations('Super Admin cannot manage school fee operations'));
feeManagementRouter.use(requireModuleFeatureEnabled('module_fees', 'Fees module is disabled by the platform administrator'));

feeManagementRouter.get('/metadata', getFeeMetadata);

feeManagementRouter.get('/particulars', listFeeParticulars);
feeManagementRouter.post('/particulars', createFeeParticular);
feeManagementRouter.patch('/particulars/:id', updateFeeParticular);
feeManagementRouter.delete('/particulars/:id', deleteFeeParticular);

feeManagementRouter.get('/types', listFeeTypes);
feeManagementRouter.post('/types', createFeeType);
feeManagementRouter.patch('/types/:id', updateFeeType);
feeManagementRouter.delete('/types/:id', deleteFeeType);

feeManagementRouter.get('/groups', listFeeGroups);
feeManagementRouter.post('/groups', createFeeGroup);
feeManagementRouter.patch('/groups/:id', updateFeeGroup);
feeManagementRouter.delete('/groups/:id', deleteFeeGroup);

feeManagementRouter.get('/masters', listFeeMasters);
feeManagementRouter.post('/masters', createFeeMaster);
feeManagementRouter.patch('/masters/:id', updateFeeMaster);
feeManagementRouter.delete('/masters/:id', deleteFeeMaster);
feeManagementRouter.post('/masters/:id/duplicate', duplicateFeeMaster);
feeManagementRouter.get('/masters/:masterId/fine-rules', listFeeFineRules);
feeManagementRouter.post('/masters/:masterId/fine-rules', createFeeFineRule);

feeManagementRouter.get('/structures', listFeeStructures);
feeManagementRouter.post('/structures', createFeeStructure);
feeManagementRouter.patch('/structures/:id', updateFeeStructure);
feeManagementRouter.delete('/structures/:id', deleteFeeStructure);
feeManagementRouter.post('/structures/:id/duplicate', duplicateFeeStructure);

feeManagementRouter.get('/assignments', listFeeAssignments);
feeManagementRouter.post('/assignments', assignStudentFees);
feeManagementRouter.patch('/assignments/:id', updateFeeAssignment);
feeManagementRouter.delete('/assignments/:id', deleteFeeAssignment);
feeManagementRouter.patch('/assignments/:id/activate', activateFeeAssignment);
feeManagementRouter.patch('/assignments/:id/deactivate', deactivateFeeAssignment);

feeManagementRouter.get('/invoices', listFeeInvoices);
feeManagementRouter.post('/invoices/preview', previewFeeInvoices);
feeManagementRouter.post('/invoices/generate', generateFeeInvoices);
feeManagementRouter.patch('/invoices/:id/cancel', cancelFeeInvoice);

feeManagementRouter.get('/carry-forwards', listFeeCarryForwards);
feeManagementRouter.post('/carry-forwards/preview', previewFeeCarryForward);
feeManagementRouter.post('/carry-forwards', createFeeCarryForward);
feeManagementRouter.post('/carry-forwards/:id/generate-invoice', generateCarryForwardInvoice);
feeManagementRouter.patch('/carry-forwards/:id/cancel', cancelFeeCarryForward);

feeManagementRouter.get('/payments', requireModuleFeatureEnabled('feature_fee_collection', 'Fee Collection is disabled by the platform administrator'), listFeePayments);
feeManagementRouter.post('/payments', requireModuleFeatureEnabled('feature_fee_collection', 'Fee Collection is disabled by the platform administrator'), collectFeePayment);
feeManagementRouter.post('/payments/:id/reverse', requireModuleFeatureEnabled('feature_fee_collection', 'Fee Collection is disabled by the platform administrator'), reverseFeePayment);
feeManagementRouter.get('/collection/students', requireModuleFeatureEnabled('feature_fee_collection', 'Fee Collection is disabled by the platform administrator'), searchFeeCollectionStudents);
feeManagementRouter.post('/collection/students/:studentId/notify-payment', requireModuleFeatureEnabled('feature_fee_collection', 'Fee Collection is disabled by the platform administrator'), notifyStudentFeePayment);
feeManagementRouter.get('/collection/students/:studentId/invoices', requireModuleFeatureEnabled('feature_fee_collection', 'Fee Collection is disabled by the platform administrator'), listStudentCollectionInvoices);

feeManagementRouter.get('/ledger', getStudentFeeLedger);
feeManagementRouter.get('/ledger/export.pdf', exportFeeLedgerPdf);
feeManagementRouter.get('/ledger/export.xlsx', exportFeeLedgerExcel);
feeManagementRouter.get('/ledger/:studentId/export.pdf', exportFeeLedgerPdf);
feeManagementRouter.get('/ledger/:studentId/export.xlsx', exportFeeLedgerExcel);
feeManagementRouter.get('/ledger/:studentId', getStudentFeeLedger);

feeManagementRouter.get('/discounts', listFeeDiscounts);
feeManagementRouter.post('/discounts', createFeeDiscount);
feeManagementRouter.patch('/discounts/:id', updateFeeDiscount);
feeManagementRouter.delete('/discounts/:id', deleteFeeDiscount);
feeManagementRouter.patch('/discounts/:id/approve', approveFeeDiscount);
feeManagementRouter.patch('/discounts/:id/reject', rejectFeeDiscount);
feeManagementRouter.patch('/discounts/:id/activate', activateFeeDiscount);
feeManagementRouter.patch('/discounts/:id/deactivate', deactivateFeeDiscount);

feeManagementRouter.get('/fines', listFeeFines);
feeManagementRouter.post('/fines', createFeeFine);
feeManagementRouter.delete('/fines/:id', deleteFeeFine);

feeManagementRouter.get('/fine-rules', listFeeFineRules);
feeManagementRouter.patch('/fine-rules/:id', updateFeeFineRule);
feeManagementRouter.delete('/fine-rules/:id', deleteFeeFineRule);

feeManagementRouter.get('/reports/export', requireModuleFeatureEnabled('feature_fee_reports', 'Fee Reports are disabled by the platform administrator'), exportFeeReports);
feeManagementRouter.get('/reports', requireModuleFeatureEnabled('feature_fee_reports', 'Fee Reports are disabled by the platform administrator'), getFeeReports);
