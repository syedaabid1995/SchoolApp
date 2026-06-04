import { Router } from 'express';
import { authMiddleware } from '../middlewares/auth.middleware';
import {
  blockSchoolOnboardingApi,
  getSchoolOnboardingApi,
  goLiveSchoolOnboardingApi,
  recalculateSchoolOnboardingApi,
  requestSchoolOnboardingReviewApi,
  updateSchoolOnboardingChecklistApi,
} from '../controllers/schoolOnboarding.controller';

export const schoolOnboardingRouter = Router();

schoolOnboardingRouter.use(authMiddleware);

schoolOnboardingRouter.get('/:schoolId/onboarding', getSchoolOnboardingApi);
schoolOnboardingRouter.put('/:schoolId/onboarding/checklist/:key', updateSchoolOnboardingChecklistApi);
schoolOnboardingRouter.post('/:schoolId/onboarding/recalculate', recalculateSchoolOnboardingApi);
schoolOnboardingRouter.post('/:schoolId/onboarding/request-review', requestSchoolOnboardingReviewApi);
schoolOnboardingRouter.post('/:schoolId/onboarding/go-live', goLiveSchoolOnboardingApi);
schoolOnboardingRouter.post('/:schoolId/onboarding/block', blockSchoolOnboardingApi);
