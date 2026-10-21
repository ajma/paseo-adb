import { it, expect } from "vitest";
import { AdbClient } from "./adb";

it("does not treat a zero-exit ADB failure as a connection", async () => {
  const adb = new AdbClient(
    "adb",
    async () => "failed to connect to '192.168.1.2:1234': Connection refused",
  );
  await expect(adb.connect("192.168.1.2:1234")).rejects.toThrow(
    /failed to connect/i,
  );
});
it("accepts already-connected results and uses argument arrays", async () => {
  const calls: string[][] = [];
  const adb = new AdbClient("adb", async (args) => {
    calls.push(args);
    return "already connected to 192.168.1.2:1234";
  });
  expect(await adb.connect(" 192.168.1.2:1234 ")).toContain(
    "already connected",
  );
  expect(calls).toEqual([["connect", "192.168.1.2:1234"]]);
});
it("retains offline and unauthorized devices when metadata fails", async () => {
  const adb = new AdbClient("adb", async (args) => {
    if (args[0] === "devices")
      return "List of devices attached\nABC device model:Pixel_6\nDEF offline\nGHI unauthorized\n";
    throw new Error("device went offline");
  });
  expect(await adb.devices()).toEqual([
    { serial: "ABC", state: "device", model: "Pixel 6", network: false },
    { serial: "DEF", state: "offline", network: false },
    { serial: "GHI", state: "unauthorized", network: false },
  ]);
});
it("reads make, model, and Android version from the authorized device", async () => {
  const adb = new AdbClient("adb", async (args) =>
    args[0] === "devices"
      ? "List of devices attached\nABC device model:Pixel_6\n"
      : "[ro.product.manufacturer]: [Google]\n[ro.product.model]: [Pixel 6]\n[ro.build.version.release]: [16]\n",
  );
  expect((await adb.devices())[0]).toMatchObject({
    manufacturer: "Google",
    model: "Pixel 6",
    androidVersion: "16",
  });
});
it("rejects disconnecting arbitrary or USB serials", async () => {
  const adb = new AdbClient(
    "adb",
    async () => "List of devices attached\nABC device\n",
  );
  await expect(adb.disconnect("ABC")).rejects.toThrow(/network/i);
  await expect(adb.disconnect("-a")).rejects.toThrow();
});
it("rejects a textual pairing failure", async () => {
  const adb = new AdbClient("adb", async () => "Failed: Wrong password");
  await expect(adb.pair("192.168.1.2:3456", "secret")).rejects.toThrow(/pair/i);
});
