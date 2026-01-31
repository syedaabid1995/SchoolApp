import { Router } from 'express';
import { otpRateLimit } from '../middlewares/rate-limit.middleware';
import { requestOtpApi, verifyOtpApi } from '../controllers/otp.controller';

export const otpRouter = Router();

otpRouter.post('/request', otpRateLimit(), requestOtpApi);

otpRouter.post('/verify', otpRateLimit(), verifyOtpApi);
