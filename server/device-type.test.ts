import { expect, it } from "vitest";
import { detectDeviceType } from "./device-type";
import { deviceTypeIcons } from "../shared/device-type";

it("detects a Wear OS watch from Android's required feature", () => {
  const type = detectDeviceType(
    "WATCH-SERIAL",
    {},
    "feature:android.hardware.telephony\nfeature:android.hardware.type.watch\n",
  );
  expect(type).toBe("watch");
  expect(deviceTypeIcons[type]).toBe("Watch");
});

it.each([
  ["watch,nosdcard", "watch"],
  ["tablet,nosdcard", "tablet"],
  ["tv", "tv"],
  ["automotive", "automotive"],
  ["phone", "phone"],
  ["nosdcard", "unknown"],
])("recognizes build characteristics %s", (characteristics, expected) => {
  expect(
    detectDeviceType("ABC", { "ro.build.characteristics": characteristics }),
  ).toBe(expected);
});

it("uses emulator identity only when no specific form factor is reported", () => {
  expect(detectDeviceType("emulator-5554", {})).toBe("emulator");
  expect(
    detectDeviceType("emulator-5554", { "ro.build.characteristics": "watch" }),
  ).toBe("watch");
});

it("does not guess a watch from its model name", () => {
  expect(detectDeviceType("ABC", { "ro.product.model": "Pixel Watch" })).toBe(
    "unknown",
  );
});
