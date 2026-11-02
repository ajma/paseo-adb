import { afterEach, expect, it } from "vitest";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DeviceNameStore } from "./device-names";
import { deviceDisplayName } from "../shared/device-name";
import type { Device } from "../shared/contracts";

const directories: string[] = [];
async function setup() {
  const dir = await mkdtemp(join(tmpdir(), "paseo-adb-names-"));
  directories.push(dir);
  const file = join(dir, "names.json");
  return { file, store: new DeviceNameStore(file) };
}
afterEach(async () => {
  await Promise.all(
    directories
      .splice(0)
      .map((dir) => rm(dir, { recursive: true, force: true })),
  );
});
const phone: Device = {
  serial: "192.168.1.2:5555",
  hardwareSerial: "PHONE1",
  state: "device",
  network: true,
  manufacturer: "Google",
  model: "Pixel 6",
};

it("persists names across reloads and transports, retaining the first original name on later renames", async () => {
  const { file, store } = await setup();
  await store.rename(phone, "  Desk phone  ");
  const wireless = { ...phone, serial: "192.168.1.3:45678" };
  const reloaded = new DeviceNameStore(file);
  const [renamed] = await reloaded.apply([wireless]);
  expect(deviceDisplayName(renamed)).toBe("Desk phone (Google Pixel 6)");
  await reloaded.rename({ ...wireless, model: "Changed model" }, "Test phone");
  const [usb] = await reloaded.apply([
    { ...phone, serial: "PHONE1", network: false },
  ]);
  expect(deviceDisplayName(usb)).toBe("Test phone (Google Pixel 6)");
  expect(
    (
      await reloaded.apply([
        { serial: "PHONE1", state: "offline", network: false },
      ])
    )[0].customName,
  ).toBe("Test phone");
  await reloaded.rename(usb, "   ");
  expect(await new DeviceNameStore(file).apply([phone])).toEqual([phone]);
});

it("keeps identical models separate and does not reuse a name for another device on the same address", async () => {
  const { store } = await setup();
  const other = {
    ...phone,
    serial: "192.168.1.4:5555",
    hardwareSerial: "PHONE2",
  };
  await Promise.all([store.rename(phone, "One"), store.rename(other, "Two")]);
  expect((await store.apply([phone, other])).map(deviceDisplayName)).toEqual([
    "One (Google Pixel 6)",
    "Two (Google Pixel 6)",
  ]);
  const replacement = { ...phone, hardwareSerial: "PHONE3" };
  expect(await store.apply([replacement])).toEqual([replacement]);
});

it("can name an unauthorized device, then learns its hardware identity on authorization", async () => {
  const { file, store } = await setup();
  const unauthorized: Device = {
    serial: "USB",
    state: "unauthorized",
    network: false,
  };
  await store.rename(unauthorized, "Work phone");
  await store.apply([{ ...phone, serial: "USB", network: false }]);
  expect(
    deviceDisplayName((await new DeviceNameStore(file).apply([phone]))[0]),
  ).toBe("Work phone (USB)");
});

it("preserves corrupt files and rejects overlong names before saving", async () => {
  const { file, store } = await setup();
  expect(() => store.rename(phone, "x".repeat(101))).toThrow();
  await writeFile(file, "{broken");
  await expect(store.rename(phone, "Desk")).rejects.toThrow(
    /saved device names/,
  );
  expect(await readFile(file, "utf8")).toBe("{broken");
});
