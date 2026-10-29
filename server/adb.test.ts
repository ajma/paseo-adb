import { it, expect, vi } from "vitest";
import { execFileSync } from "node:child_process";
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

it("uses system features when build properties omit a watch category", async () => {
  const adb = new AdbClient("adb", async (args) => {
    if (args[0] === "devices")
      return "List of devices attached\nWATCH device model:Pixel_Watch\n";
    if (args.includes("getprop"))
      return "[ro.product.model]: [Pixel Watch]\n[ro.build.characteristics]: [nosdcard]\n";
    if (args.slice(-3).join(" ") === "pm list features")
      return "feature:android.hardware.type.watch\n";
    throw new Error("Unexpected command");
  });
  expect((await adb.devices())[0]).toMatchObject({
    model: "Pixel Watch",
    deviceType: "watch",
  });
});

it("keeps device metadata when feature detection fails", async () => {
  const adb = new AdbClient("adb", async (args) => {
    if (args[0] === "devices") return "List of devices attached\nABC device\n";
    if (args.includes("getprop"))
      return "[ro.product.model]: [Mystery Device]\n";
    throw new Error("Package manager unavailable");
  });
  expect((await adb.devices())[0]).toMatchObject({
    model: "Mystery Device",
    deviceType: "unknown",
  });
});

it
  .skipIf(process.platform === "win32")
  .each([
    "  hello world  ",
    'It\'s a test: "quotes" & punctuation; $(printf INJECTED) `printf INJECTED` | < > \\ $HOME',
    "%s %%s %s%s 100% safe",
    Array.from({ length: 95 }, (_, i) => String.fromCharCode(i + 32)).join(""),
  ])(
  "sends literal text to the selected device through the remote shell: %s",
  async (text) => {
    const calls: string[][] = [];
    const adb = new AdbClient("adb", async (args) => {
      calls.push(args);
      if (args[0] === "devices")
        return "List of devices attached\nUSB device\n192.168.1.2:5555 device\n";
      expect(args.slice(0, 3)).toEqual(["-s", "192.168.1.2:5555", "shell"]);
      // Exercise a real shell with an input stand-in that captures arguments.
      const output = execFileSync(
        "/bin/sh",
        [
          "-c",
          [
            'input() { [ "$#" -eq 2 ] && [ "$1" = text ] || exit 99; printf \'%s\\0\' "$2"; }',
            args[3],
          ].join("\n"),
        ],
        { encoding: "utf8" },
      );
      const typed = output
        .split("\0")
        .map((part) => part.replace(/%s/g, " "))
        .join("");
      expect(typed).toBe(text);
      return "";
    });
    await expect(adb.inputText("192.168.1.2:5555", text)).resolves.toContain(
      "Text sent",
    );
    expect(calls).toHaveLength(2);
  },
);

it.each(["USB", "OFFLINE", "UNAUTHORIZED", "missing", "-a"])(
  "refuses to send text to an unavailable or unauthorized target: %s",
  async (serial) => {
    const run = vi.fn(
      async () =>
        "List of devices attached\nUSB offline\nOFFLINE offline\nUNAUTHORIZED unauthorized\n",
    );
    const adb = new AdbClient("adb", run);
    await expect(adb.inputText(serial, "hello")).rejects.toThrow(
      /connected, authorized/,
    );
    expect(run).toHaveBeenCalledTimes(1);
  },
);

it.each(["", "hello\nworld", "emoji 😀", "a\0b", "x".repeat(2001)])(
  "rejects unsupported text before running ADB",
  async (text) => {
    const run = vi.fn(async () => "");
    await expect(
      new AdbClient("adb", run).inputText("USB", text),
    ).rejects.toThrow();
    expect(run).not.toHaveBeenCalled();
  },
);

it("propagates an input failure without retrying", async () => {
  const run = vi.fn(async (args: string[]) => {
    if (args[0] === "devices") return "List of devices attached\nUSB device\n";
    throw new Error("device went offline");
  });
  await expect(
    new AdbClient("adb", run).inputText("USB", "hello"),
  ).rejects.toThrow("device went offline");
  expect(run).toHaveBeenCalledTimes(2);
});
