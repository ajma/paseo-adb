import { z } from "zod";

export const deviceTypeSchema = z.enum([
  "phone",
  "tablet",
  "watch",
  "tv",
  "automotive",
  "emulator",
  "unknown",
]);
export type DeviceType = z.infer<typeof deviceTypeSchema>;

export const deviceTypeIcons: Record<DeviceType, string> = {
  phone: "Smartphone",
  tablet: "Tablet",
  watch: "Watch",
  tv: "Tv",
  automotive: "Car",
  emulator: "MonitorSmartphone",
  unknown: "MonitorSmartphone",
};
