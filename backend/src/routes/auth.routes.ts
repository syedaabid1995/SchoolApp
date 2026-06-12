import { Router } from 'express';
import {
  login,
  resendTwoFactor,
  startTotpSetup,
  verifyTotpSetup,
  disableTotp,
  verifyTotpLogin,
  verifyTwoFactor,
  refreshToken,
  logout,
  changePassword,
  forgotPassword,
  resetPassword,
  listSessions,
  revokeSession,
  logoutAll,
} from '../controllers/auth.controller';
import { getPublicLoginExperience } from '../controllers/loginExperience.controller';
import { authMiddleware } from '../middlewares/auth.middleware';
import { validateBody, validateParams } from '../middlewares/validation.middleware';
import {
  forgotPasswordRateLimit,
  loginIpRateLimit,
  mfaResendIpRateLimit,
  mfaVerifyRateLimit,
} from '../middlewares/rate-limit.middleware';
import {
  changePasswordSchema,
  forgotPasswordSchema,
  loginSchema,
  refreshSchema,
  resendTwoFactorSchema,
  resetPasswordSchema,
  revokeSessionParamsSchema,
  totpDisableSchema,
  totpVerifyLoginSchema,
  totpVerifySetupSchema,
  verifyTwoFactorSchema,
} from '../validations/auth.validation';

export const authRouter = Router();

authRouter.get('/login-experience', getPublicLoginExperience);

authRouter.post('/login', loginIpRateLimit(), validateBody(loginSchema), login);

authRouter.post('/verify-2fa', mfaVerifyRateLimit(), validateBody(verifyTwoFactorSchema), verifyTwoFactor);

authRouter.post('/resend-2fa', mfaResendIpRateLimit(), validateBody(resendTwoFactorSchema), resendTwoFactor);

authRouter.post('/totp/setup', authMiddleware, startTotpSetup);

authRouter.post('/totp/verify-setup', authMiddleware, validateBody(totpVerifySetupSchema), verifyTotpSetup);

authRouter.post('/totp/disable', authMiddleware, validateBody(totpDisableSchema), disableTotp);

authRouter.post('/totp/verify-login', mfaVerifyRateLimit(), validateBody(totpVerifyLoginSchema), verifyTotpLogin);

authRouter.post('/forgot-password', forgotPasswordRateLimit(), validateBody(forgotPasswordSchema), forgotPassword);

authRouter.post('/reset-password', validateBody(resetPasswordSchema), resetPassword);

authRouter.post('/refresh', validateBody(refreshSchema), refreshToken);

authRouter.post('/logout', logout);

authRouter.post('/change-password', authMiddleware, validateBody(changePasswordSchema), changePassword);

authRouter.get('/sessions', authMiddleware, listSessions);

authRouter.delete('/sessions/:sessionId', authMiddleware, validateParams(revokeSessionParamsSchema), revokeSession);

authRouter.post('/logout-all', authMiddleware, logoutAll);
