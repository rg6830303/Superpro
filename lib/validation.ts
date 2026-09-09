import { z } from "zod";

export const phoneSchema = z
  .string()
  .trim()
  .transform((v) => v.replace(/\D/g, ""))
  .refine((v) => /^[6-9]\d{9}$/.test(v), "Enter a valid 10-digit Indian mobile number");

export const emailSchema = z.string().trim().toLowerCase().email("Enter a valid email address");

export const skillSchema = z.enum(["beginner", "intermediate", "advanced", "pro"]);
export const paymentMethodSchema = z.enum(["razorpay", "cod", "venue", "wallet"]);

/**
 * Signup collects DUPR, not a self-declared level: the category is derived from
 * the rating (lib/dupr.ts) so the two can never drift apart. Both fields are
 * optional — an unrated player joins as a beginner.
 */
export const duprIdSchema = z
  .string()
  .trim()
  .max(24, "That DUPR ID looks too long")
  .optional()
  .or(z.literal(""));

export const duprRatingSchema = z
  .number()
  .min(2, "DUPR ratings start at 2.0")
  .max(8, "DUPR ratings top out at 8.0")
  .nullable()
  .optional();

export const signupSchema = z.object({
  full_name: z.string().trim().min(2, "Enter your full name").max(80),
  email: emailSchema,
  password: z.string().min(8, "Password must be at least 8 characters").max(128),
  phone: phoneSchema,
  dupr_id: duprIdSchema,
  dupr: duprRatingSchema,
});

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, "Enter your password").max(128),
});

export const playerRegistrationSchema = z.object({
  player_name: z.string().trim().min(2, "Enter the player's name").max(80),
  player_phone: phoneSchema,
  player_email: emailSchema.optional().or(z.literal("")),
  skill_level: skillSchema.default("beginner"),
  session_ids: z.array(z.string().uuid()).min(1, "Pick at least one slot").max(14),
  players_count: z.number().int().min(1).max(4).default(1),
  payment_method: paymentMethodSchema.default("venue"),
  notes: z.string().trim().max(400).optional(),
});

export const coachingBookingSchema = z.object({
  coach_id: z.string().uuid("Pick a coach"),
  player_name: z.string().trim().min(2, "Enter your name").max(80),
  player_phone: phoneSchema,
  player_email: emailSchema.optional().or(z.literal("")),
  skill_level: skillSchema.default("beginner"),
  session_type: z.enum(["single", "pair", "group"]).default("single"),
  sessions_count: z.number().int().min(1).max(20).default(1),
  preferred_date: z.string().trim().min(1, "Pick a preferred date"),
  preferred_time: z.string().trim().min(1, "Pick a preferred time"),
  payment_method: paymentMethodSchema.default("venue"),
  notes: z.string().trim().max(400).optional(),
});

export const orderItemSchema = z.object({
  product_id: z.string().uuid(),
  qty: z.number().int().min(1).max(20),
});

export const orderSchema = z.object({
  customer_name: z.string().trim().min(2, "Enter your name").max(80),
  customer_phone: phoneSchema,
  customer_email: emailSchema.optional().or(z.literal("")),
  items: z.array(orderItemSchema).min(1, "Your cart is empty"),
  delivery_mode: z.enum(["pickup", "delivery"]).default("pickup"),
  address: z
    .object({
      line1: z.string().trim().max(160).optional(),
      line2: z.string().trim().max(160).optional(),
      city: z.string().trim().max(60).optional(),
      pincode: z.string().trim().max(10).optional(),
    })
    .optional(),
  payment_method: paymentMethodSchema.default("razorpay"),
  notes: z.string().trim().max(400).optional(),
});

export const tournamentRegistrationSchema = z.object({
  tournament_id: z.string().uuid(),
  team_name: z.string().trim().min(2, "Enter a team name").max(60),
  category: z.string().trim().max(60).optional(),
  player1_name: z.string().trim().min(2, "Enter player 1's name").max(80),
  player1_phone: phoneSchema,
  player1_dupr: z.number().min(2).max(8).optional().nullable(),
  player2_name: z.string().trim().max(80).optional(),
  player2_phone: z
    .string()
    .trim()
    .transform((v) => v.replace(/\D/g, ""))
    .refine((v) => v === "" || /^[6-9]\d{9}$/.test(v), "Enter a valid 10-digit number")
    .optional(),
  player2_dupr: z.number().min(2).max(8).optional().nullable(),
  email: emailSchema.optional().or(z.literal("")),
  payment_method: paymentMethodSchema.default("venue"),
  notes: z.string().trim().max(400).optional(),
  /** Answers to the tournament's own form fields, keyed by field_key. */
  answers: z.record(z.string(), z.union([z.string(), z.number(), z.boolean()])).optional(),
});

/** Flatten a ZodError into one human sentence for the API response. */
export function formatZodError(error: z.ZodError): string {
  return error.issues.map((i) => i.message).join(". ");
}
