import { Router } from 'express';
import { getPublicLoginBranding } from '../controllers/branding.controller';

export const publicBrandingRouter = Router();

publicBrandingRouter.get('/login', getPublicLoginBranding);
