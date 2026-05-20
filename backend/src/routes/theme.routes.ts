import { Router } from 'express';
import { authMiddleware } from '../middlewares/auth.middleware';
import { requireSchoolAdminOrSuperAdmin } from '../middlewares/rbac.middleware';
import {
  createTheme,
  updateThemeTokens,
  publishTheme,
  rollbackTheme,
  listThemes,
  getActiveTheme,
  getLoginBrandingSettings,
  updateLoginBrandingSettings,
  publishLoginBranding,
  rollbackLoginBranding,
  resetLoginBranding,
} from '../controllers/theme.controller';

export const themeRouter = Router();

themeRouter.use(authMiddleware);
themeRouter.use(requireSchoolAdminOrSuperAdmin);

themeRouter.post('/', createTheme);

themeRouter.get('/', listThemes);

themeRouter.get('/active', getActiveTheme);

themeRouter.get('/login-branding', getLoginBrandingSettings);

themeRouter.put('/login-branding', updateLoginBrandingSettings);

themeRouter.post('/login-branding/publish', publishLoginBranding);

themeRouter.post('/login-branding/rollback', rollbackLoginBranding);

themeRouter.post('/login-branding/reset', resetLoginBranding);

themeRouter.patch('/:id', updateThemeTokens);

themeRouter.post('/:id/publish', publishTheme);

themeRouter.post('/:id/rollback', rollbackTheme);
