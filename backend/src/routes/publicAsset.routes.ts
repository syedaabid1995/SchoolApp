import { Router } from 'express';
import { getPublicBrandingAsset } from '../controllers/publicAsset.controller';

export const publicAssetRouter = Router();

publicAssetRouter.get('/branding', getPublicBrandingAsset);
