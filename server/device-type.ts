import type { DeviceType } from "../shared/device-type";

export function detectDeviceType(
  serial: string,
  properties: Record<string, string>,
  featureOutput = "",
): DeviceType {
  const characteristics = new Set(
    (properties["ro.build.characteristics"] ?? "")
      .toLowerCase()
      .split(",")
      .map((value) => value.trim()),
  );
  const features = new Set(
    featureOutput.split(/\r?\n/).map(
      (line) =>
        line
          .trim()
          .replace(/^feature:/, "")
          .split("=")[0],
    ),
  );
  if (
    characteristics.has("watch") ||
    features.has("android.hardware.type.watch")
  )
    return "watch";
  if (
    characteristics.has("tv") ||
    features.has("android.hardware.type.television") ||
    features.has("android.software.leanback")
  )
    return "tv";
  if (
    characteristics.has("automotive") ||
    features.has("android.hardware.type.automotive")
  )
    return "automotive";
  if (characteristics.has("tablet")) return "tablet";
  if (
    serial.startsWith("emulator-") ||
    properties["ro.kernel.qemu"] === "1" ||
    properties["ro.boot.qemu"] === "1"
  )
    return "emulator";
  if (
    characteristics.has("phone") ||
    features.has("android.hardware.telephony")
  )
    return "phone";
  return "unknown";
}
