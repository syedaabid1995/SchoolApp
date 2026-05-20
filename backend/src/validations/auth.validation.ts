import { z } from 'zod';

export const loginTypeSchema = z.enum(['admin', 'staff', 'teacher', 'student', 'parent']);

export const loginSchema = z
  .object({
    email: z.string().trim().email().optional(),
    username: z.string().trim().min(1).max(255).optional(),
    password: z.string().min(8),
    schoolId: z.string().trim().uuid().optional(),
    schoolCode: z.string().trim().min(1).max(64).optional(),
    rememberMe: z.boolean().optional().default(false),
    loginType: loginTypeSchema.optional(),
  })
  .superRefine((value, ctx) => {
    if (!value.email && !value.username) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['email'],
        message: 'Email or username is required.',
      });
    }
  });

export const refreshSchema = z.object({
  refreshToken: z.string().min(1).optional(),
});

export const verifyTwoFactorSchema = z.object({
  challengeId: z.string().trim().uuid(),
  otp: z.string().trim().regex(/^\d{6}$/),
  rememberMe: z.boolean().optional().default(false),
});

export const resendTwoFactorSchema = z.object({
  challengeId: z.string().trim().uuid(),
});

export const totpVerifySetupSchema = z.object({
  code: z.string().trim().regex(/^\d{6}$/),
});

export const totpDisableSchema = z.object({
  code: z.string().trim().min(6).max(16),
});

export const totpVerifyLoginSchema = z.object({
  challengeId: z.string().trim().uuid(),
  code: z.string().trim().min(6).max(16),
  rememberMe: z.boolean().optional().default(false),
});

const strongPasswordSchema = z
  .string()
  .min(8, 'Password must be at least 8 characters.')
  .regex(/[A-Z]/, 'Password must include at least one uppercase letter.')
  .regex(/[a-z]/, 'Password must include at least one lowercase letter.')
  .regex(/[0-9]/, 'Password must include at least one number.')
  .regex(/[^A-Za-z0-9]/, 'Password must include at least one special character.');

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, 'Current password is required.'),
    newPassword: strongPasswordSchema,
    confirmPassword: z.string().min(1, 'Confirm password is required.'),
  })
  .superRefine((value, ctx) => {
    if (value.newPassword !== value.confirmPassword) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['confirmPassword'],
        message: 'Passwords do not match.',
      });
    }
    if (value.currentPassword === value.newPassword) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['newPassword'],
        message: 'New password must be different from current password.',
      });
    }
  });

export const forgotPasswordSchema = z.object({
  email: z.string().trim().email(),
  schoolId: z.string().trim().uuid().optional(),
  schoolCode: z.string().trim().min(1).max(64).optional(),
  loginType: loginTypeSchema.optional(),
});

export const resetPasswordSchema = z
  .object({
    token: z.string().trim().min(1),
    newPassword: strongPasswordSchema,
    confirmPassword: z.string().min(1),
  })
  .superRefine((value, ctx) => {
    if (value.newPassword !== value.confirmPassword) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['confirmPassword'],
        message: 'Passwords do not match.',
      });
    }
  });

export type LoginType = z.infer<typeof loginTypeSchema>;
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;
export type VerifyTwoFactorInput = z.infer<typeof verifyTwoFactorSchema>;
export type ResendTwoFactorInput = z.infer<typeof resendTwoFactorSchema>;
export type TotpVerifySetupInput = z.infer<typeof totpVerifySetupSchema>;
export type TotpDisableInput = z.infer<typeof totpDisableSchema>;
export type TotpVerifyLoginInput = z.infer<typeof totpVerifyLoginSchema>;
