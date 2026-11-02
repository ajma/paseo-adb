import { z } from "zod";
import type { Device } from "./contracts";

export const MAX_DEVICE_NAME_LENGTH = 100;
// An empty name removes the custom name.
export const deviceNameSchema = z.string().trim().max(MAX_DEVICE_NAME_LENGTH);

export function originalDeviceName(device: Device): string {
  return (
    device.originalName ||
    [device.manufacturer, device.model].filter(Boolean).join(" ") ||
    device.serial
  );
}

export function deviceDisplayName(device: Device): string {
  const original = originalDeviceName(device);
  return device.customName ? `${device.customName} (${original})` : original;
}
