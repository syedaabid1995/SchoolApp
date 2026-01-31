import { Router } from 'express';
import { authMiddleware } from '../middlewares/auth.middleware';
import {
  createFeatureFlag,
  listFeatureFlags,
  updateFeatureFlag,
  deleteFeatureFlag,
  setFeatureOverride,
  createConfigEntry,
  listConfigEntries,
  updateConfigEntry,
  setTenantConfigOverride,
} from '../controllers/feature-flag.controller';

export const featureFlagRouter = Router();

featureFlagRouter.use(authMiddleware);

featureFlagRouter.post('/flags', createFeatureFlag);
featureFlagRouter.get('/flags', listFeatureFlags);
featureFlagRouter.patch('/flags/:id', updateFeatureFlag);
featureFlagRouter.delete('/flags/:id', deleteFeatureFlag);
featureFlagRouter.post('/overrides', setFeatureOverride);

featureFlagRouter.post('/configs', createConfigEntry);
featureFlagRouter.get('/configs', listConfigEntries);
featureFlagRouter.patch('/configs/:id', updateConfigEntry);
featureFlagRouter.post('/configs/overrides', setTenantConfigOverride);
