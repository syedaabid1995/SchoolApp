import { Router, type NextFunction, type Request, type Response } from 'express';
import multer from 'multer';
import {
  approveExpenseChangeRequest,
  createExpense,
  createExpenseCategory,
  deleteExpense,
  deleteExpenseCategory,
  exportExpenses,
  getExpenseMetadata,
  listExpenseCategories,
  listExpenseChangeRequests,
  listExpenses,
  rejectExpenseChangeRequest,
  redirectExpenseReceipt,
  updateExpense,
  updateExpenseCategory,
} from '../controllers/expense.controller';
import { authMiddleware } from '../middlewares/auth.middleware';
import { requireModuleFeatureEnabled } from '../middlewares/feature-flag.middleware';

const receiptFilter: multer.Options['fileFilter'] = (_req, file, cb) => {
  const allowed = [
    'application/pdf',
    'image/jpeg',
    'image/png',
    'image/webp',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  ];
  if (allowed.includes(file.mimetype)) {
    cb(null, true);
    return;
  }
  cb(new Error('Unsupported receipt type'));
};

const receiptUpload = multer({
  storage: multer.memoryStorage(),
  fileFilter: receiptFilter,
  limits: { fileSize: 10 * 1024 * 1024, files: 1 },
});

const runReceiptUpload = (req: Request, res: Response, next: NextFunction) => {
  receiptUpload.single('receipt')(req, res, (err) => {
    if (!err) {
      next();
      return;
    }
    const message =
      err instanceof multer.MulterError && err.code === 'LIMIT_FILE_SIZE'
        ? 'Receipt file is too large'
        : err instanceof Error
          ? err.message
          : 'Invalid receipt upload';
    res.status(400).json({ error: { message, details: null } });
  });
};

export const expenseRouter = Router();

expenseRouter.use(authMiddleware);
expenseRouter.use(requireModuleFeatureEnabled('module_expenses', 'Expenses module is disabled by the platform administrator'));

expenseRouter.get('/metadata', getExpenseMetadata);

expenseRouter.get('/categories', listExpenseCategories);
expenseRouter.post('/categories', createExpenseCategory);
expenseRouter.patch('/categories/:id', updateExpenseCategory);
expenseRouter.delete('/categories/:id', deleteExpenseCategory);

expenseRouter.get('/change-requests', listExpenseChangeRequests);
expenseRouter.patch('/change-requests/:id/approve', approveExpenseChangeRequest);
expenseRouter.patch('/change-requests/:id/reject', rejectExpenseChangeRequest);

expenseRouter.get('/export', exportExpenses);
expenseRouter.get('/', listExpenses);
expenseRouter.post('/', runReceiptUpload, createExpense);
expenseRouter.get('/:id/receipt', redirectExpenseReceipt);
expenseRouter.patch('/:id', runReceiptUpload, updateExpense);
expenseRouter.delete('/:id', deleteExpense);
