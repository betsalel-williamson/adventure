import { z } from "zod";

export const sessionIdSchema = z.string().uuid();
export type SessionId = z.infer<typeof sessionIdSchema>;

export const createSessionResponseSchema = z.object({
  sessionId: sessionIdSchema,
});
export type CreateSessionResponse = z.infer<typeof createSessionResponseSchema>;

export const pairingCodeSchema = z
  .string()
  .regex(/^[A-Z2-9]{6,8}$/, "Pairing code must be 6–8 uppercase alphanumeric characters");
export type PairingCode = z.infer<typeof pairingCodeSchema>;

export const issuePairingCodeResponseSchema = z.object({
  code: pairingCodeSchema,
  expiresAt: z.string().datetime(),
});
export type IssuePairingCodeResponse = z.infer<typeof issuePairingCodeResponseSchema>;

export const redeemPairingCodeRequestSchema = z.object({
  code: pairingCodeSchema,
  deviceLabel: z.string().min(1).max(128).optional(),
});
export type RedeemPairingCodeRequest = z.infer<typeof redeemPairingCodeRequestSchema>;

/** Returned once on redeem; desktop stores `deviceToken` in OS keychain only. */
export const redeemPairingCodeResponseSchema = z.object({
  deviceId: z.string().uuid(),
  deviceToken: z.string().min(32),
  sessionId: sessionIdSchema,
});
export type RedeemPairingCodeResponse = z.infer<typeof redeemPairingCodeResponseSchema>;

/** Server-side device registry entry (token stored hashed; never returned again). */
export const registeredDeviceSchema = z.object({
  deviceId: z.string().uuid(),
  sessionId: sessionIdSchema,
  deviceLabel: z.string().min(1).max(128).optional(),
  registeredAt: z.string().datetime(),
});
export type RegisteredDevice = z.infer<typeof registeredDeviceSchema>;

export const unauthorizedErrorSchema = z.object({
  error: z.literal("unauthorized"),
  message: z.string().min(1),
});
export type UnauthorizedError = z.infer<typeof unauthorizedErrorSchema>;
