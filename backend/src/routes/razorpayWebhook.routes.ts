import { Router } from 'express';
import { handleRazorpayWebhook } from '../controllers/razorpayWebhook.controller';

export const razorpayWebhookRouter = Router();

razorpayWebhookRouter.post('/', handleRazorpayWebhook);
