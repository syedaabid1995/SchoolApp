import { Router } from 'express';
import {
  assignStudentFees,
  activateFeeDiscount,
  activateFeeAssignment,
  cancelFeeInvoice,
  collectFeePayment,
  approveFeeDiscount,
  createFeeDiscount,
  createFeeFine,
  createFeeParticular,
  createFeeStructure,
  createFeeType,
  deactivateFeeDiscount,
  deactivateFeeAssignment,
  deleteFeeAssignment,
  deleteFeeDiscount,
  deleteFeeFine,
  deleteFeeParticular,
  deleteFeeStructure,
  deleteFeeType,
  duplicateFeeStructure,
  exportFeeLedgerExcel,
  exportFeeLedgerPdf,
  exportFeeReports,
  generateFeeInvoices,
  getFeeMetadata,
  getFeeReports,
  getStudentFeeLedger,
  listStudentCollectionInvoices,
  listFeeAssignments,
  listFeeDiscounts,
  listFeeFines,
  listFeeInvoices,
  listFeeParticulars,
  listFeePayments,
  listFeeStructures,
  listFeeTypes,
  previewFeeInvoices,
  searchFeeCollectionStudents,
  rejectFeeDiscount,
  updateFeeAssignment,
  updateFeeParticular,
  updateFeeDiscount,
  updateFeeStructure,
  updateFeeType,
} from '../controllers/feeManagement.controller';
import { authMiddleware } from '../middlewares/auth.middleware';

export const feeManagementRouter = Router();

feeManagementRouter.use(authMiddleware);

feeManagementRouter.get('/metadata', getFeeMetadata);

feeManagementRouter.get('/particulars', listFeeParticulars);
feeManagementRouter.post('/particulars', createFeeParticular);
feeManagementRouter.patch('/particulars/:id', updateFeeParticular);
feeManagementRouter.delete('/particulars/:id', deleteFeeParticular);

feeManagementRouter.get('/types', listFeeTypes);
feeManagementRouter.post('/types', createFeeType);
feeManagementRouter.patch('/types/:id', updateFeeType);
feeManagementRouter.delete('/types/:id', deleteFeeType);

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

feeManagementRouter.get('/payments', listFeePayments);
feeManagementRouter.post('/payments', collectFeePayment);
feeManagementRouter.get('/collection/students', searchFeeCollectionStudents);
feeManagementRouter.get('/collection/students/:studentId/invoices', listStudentCollectionInvoices);

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

feeManagementRouter.get('/reports/export', exportFeeReports);
feeManagementRouter.get('/reports', getFeeReports);
