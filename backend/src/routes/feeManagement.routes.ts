import { Router } from 'express';
import {
  assignStudentFees,
  collectFeePayment,
  createFeeDiscount,
  createFeeFine,
  createFeeParticular,
  createFeeStructure,
  createFeeType,
  deleteFeeParticular,
  deleteFeeStructure,
  deleteFeeType,
  duplicateFeeStructure,
  generateFeeInvoices,
  getFeeMetadata,
  getFeeReports,
  getStudentFeeLedger,
  listFeeAssignments,
  listFeeDiscounts,
  listFeeFines,
  listFeeInvoices,
  listFeeParticulars,
  listFeePayments,
  listFeeStructures,
  listFeeTypes,
  updateFeeParticular,
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

feeManagementRouter.get('/invoices', listFeeInvoices);
feeManagementRouter.post('/invoices/generate', generateFeeInvoices);

feeManagementRouter.get('/payments', listFeePayments);
feeManagementRouter.post('/payments', collectFeePayment);

feeManagementRouter.get('/ledger/:studentId', getStudentFeeLedger);

feeManagementRouter.get('/discounts', listFeeDiscounts);
feeManagementRouter.post('/discounts', createFeeDiscount);

feeManagementRouter.get('/fines', listFeeFines);
feeManagementRouter.post('/fines', createFeeFine);

feeManagementRouter.get('/reports', getFeeReports);
