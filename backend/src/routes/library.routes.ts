import { Router } from 'express';
import {
  cancelLibraryMember,
  createLibraryBook,
  createLibraryCategory,
  createLibraryMember,
  deleteLibraryBook,
  deleteLibraryCategory,
  issueLibraryBook,
  listIssuedLibraryBooks,
  listLibraryBooks,
  listLibraryCategories,
  listLibraryMembers,
  listMemberIssues,
  returnLibraryBook,
  updateLibraryBook,
  updateLibraryCategory,
} from '../controllers/library.controller';
import { authMiddleware } from '../middlewares/auth.middleware';

export const libraryRouter = Router();

libraryRouter.use(authMiddleware);

libraryRouter.get('/issued', listIssuedLibraryBooks);
libraryRouter.patch('/issues/:id/return', returnLibraryBook);

libraryRouter.get('/categories', listLibraryCategories);
libraryRouter.post('/categories', createLibraryCategory);
libraryRouter.patch('/categories/:id', updateLibraryCategory);
libraryRouter.delete('/categories/:id', deleteLibraryCategory);

libraryRouter.get('/books', listLibraryBooks);
libraryRouter.post('/books', createLibraryBook);
libraryRouter.patch('/books/:id', updateLibraryBook);
libraryRouter.delete('/books/:id', deleteLibraryBook);

libraryRouter.get('/members', listLibraryMembers);
libraryRouter.post('/members', createLibraryMember);
libraryRouter.delete('/members/:id', cancelLibraryMember);
libraryRouter.get('/members/:memberId/issues', listMemberIssues);
libraryRouter.post('/members/:memberId/issues', issueLibraryBook);
