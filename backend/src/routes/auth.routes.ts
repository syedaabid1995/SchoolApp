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
import {
  forgotPasswordRateLimit,
  loginIpRateLimit,
  mfaResendIpRateLimit,
  mfaVerifyRateLimit,
} from '../middlewares/rate-limit.middleware';

export const authRouter = Router();

authRouter.get('/login-experience', getPublicLoginExperience);

authRouter.post('/login', loginIpRateLimit(), login);

authRouter.post('/verify-2fa', mfaVerifyRateLimit(), verifyTwoFactor);

authRouter.post('/resend-2fa', mfaResendIpRateLimit(), resendTwoFactor);

authRouter.post('/totp/setup', authMiddleware, startTotpSetup);

authRouter.post('/totp/verify-setup', authMiddleware, verifyTotpSetup);

authRouter.post('/totp/disable', authMiddleware, disableTotp);

authRouter.post('/totp/verify-login', mfaVerifyRateLimit(), verifyTotpLogin);

authRouter.post('/forgot-password', forgotPasswordRateLimit(), forgotPassword);

authRouter.post('/reset-password', resetPassword);

authRouter.post('/refresh', refreshToken);

authRouter.post('/logout', logout);

authRouter.post('/change-password', authMiddleware, changePassword);

authRouter.get('/sessions', authMiddleware, listSessions);

authRouter.delete('/sessions/:sessionId', authMiddleware, revokeSession);

authRouter.post('/logout-all', authMiddleware, logoutAll);
