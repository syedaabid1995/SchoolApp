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
import { getLoginExperienceSettings, updateLoginExperienceSettings } from '../controllers/loginExperience.controller';
import {
  getAuthSecuritySettingsApi,
  updateAuthSecuritySettingsApi,
} from '../controllers/authSecurity.controller';

export const featureFlagRouter = Router();

featureFlagRouter.use(authMiddleware);

featureFlagRouter.get('/login-experience', getLoginExperienceSettings);
featureFlagRouter.put('/login-experience', updateLoginExperienceSettings);
featureFlagRouter.get('/auth-security', getAuthSecuritySettingsApi);
featureFlagRouter.put('/auth-security', updateAuthSecuritySettingsApi);

featureFlagRouter.post('/flags', createFeatureFlag);
featureFlagRouter.get('/flags', listFeatureFlags);
featureFlagRouter.patch('/flags/:id', updateFeatureFlag);
featureFlagRouter.delete('/flags/:id', deleteFeatureFlag);
featureFlagRouter.post('/overrides', setFeatureOverride);

featureFlagRouter.post('/configs', createConfigEntry);
featureFlagRouter.get('/configs', listConfigEntries);
featureFlagRouter.patch('/configs/:id', updateConfigEntry);
featureFlagRouter.post('/configs/overrides', setTenantConfigOverride);
