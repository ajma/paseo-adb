import { defineRpc } from "@getpaseo/plugin";
import { z } from "zod";
import { ipSchema, ipHistoryEntrySchema } from "./endpoint";
import { deviceTypeSchema } from "./device-type";
import { inputTextSchema, MAX_TEXT_HISTORY } from "./input-text";

export const deviceSchema = z.object({
  serial: z.string(),
  state: z.string(),
  network: z.boolean(),
  model: z.string().optional(),
  manufacturer: z.string().optional(),
  androidVersion: z.string().optional(),
  product: z.string().optional(),
  transportId: z.string().optional(),
  deviceType: deviceTypeSchema.optional(),
});
export type Device = z.infer<typeof deviceSchema>;
export const pairingSchema = z.object({
  id: z.string(),
  phase: z.enum([
    "waiting",
    "pairing",
    "connecting",
    "connected",
    "paired",
    "failed",
    "expired",
    "canceled",
  ]),
  qr: z.string().optional(),
  expiresAt: z.number(),
  message: z.string(),
});
export type PairingState = z.infer<typeof pairingSchema>;
const empty = z.object({});
export const devicesRpc = defineRpc({
  name: "adb.devices",
  input: empty,
  output: z.object({ devices: z.array(deviceSchema), adbPath: z.string() }),
});
export const connectRpc = defineRpc({
  name: "adb.connect",
  input: z.object({ endpoint: z.string().max(300) }),
  output: z.object({ message: z.string(), warning: z.string().optional() }),
});
export const disconnectRpc = defineRpc({
  name: "adb.disconnect",
  input: z.object({ serial: z.string().min(1).max(300) }),
  output: z.object({ message: z.string() }),
});
export const inputTextRpc = defineRpc({
  name: "adb.input.text",
  input: z.object({
    serial: z.string().min(1).max(300),
    text: inputTextSchema,
  }),
  output: z.object({ message: z.string(), warning: z.string().optional() }),
});
export const textHistoryRpc = defineRpc({
  name: "adb.input.history",
  input: empty,
  output: z.array(inputTextSchema).max(MAX_TEXT_HISTORY),
});
export const removeTextHistoryRpc = defineRpc({
  name: "adb.input.history.remove",
  input: z.object({ text: inputTextSchema }),
  output: empty,
});
export const historyRpc = defineRpc({
  name: "adb.history",
  input: empty,
  output: z.array(ipHistoryEntrySchema).max(5),
});
export const removeHistoryRpc = defineRpc({
  name: "adb.history.remove",
  input: z.object({ host: ipSchema }),
  output: empty,
});
export const startPairingRpc = defineRpc({
  name: "adb.pairing.start",
  input: empty,
  output: pairingSchema,
});
export const pairingStatusRpc = defineRpc({
  name: "adb.pairing.status",
  input: empty,
  output: pairingSchema.nullable(),
});
export const cancelPairingRpc = defineRpc({
  name: "adb.pairing.cancel",
  input: z.object({ id: z.string() }),
  output: empty,
});
