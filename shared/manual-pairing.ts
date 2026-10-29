import { z } from "zod";
import { ipSchema } from "./endpoint";

export const manualPairingInputSchema = z.object({
  host: z
    .string()
    .trim()
    .refine(
      (host) => ipSchema.safeParse(host).success,
      "Enter a valid IP address.",
    ),
  port: z
    .number()
    .int()
    .min(1, "Enter a pairing port between 1 and 65535.")
    .max(65535, "Enter a pairing port between 1 and 65535."),
  code: z
    .string()
    .trim()
    .regex(/^\d{6}$/, "Enter the six-digit pairing code shown on the device."),
});
export type ManualPairingInput = z.infer<typeof manualPairingInputSchema>;
