import { execFile } from "node:child_process";
import { access } from "node:fs/promises";
import { constants } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import type { Device } from "../shared/contracts";
import { parseEndpoint } from "../shared/endpoint";
import { parseDevices, parseServices } from "./parsers";

export type CommandOptions = { signal?: AbortSignal; timeout?: number };
export type CommandRunner = (
  args: string[],
  options?: CommandOptions,
) => Promise<string>;

export function createRunner(
  binary: string,
  lifetime: AbortSignal,
): CommandRunner {
  return (args, options = {}) =>
    new Promise((resolve, reject) => {
      execFile(
        binary,
        args,
        {
          encoding: "utf8",
          timeout: options.timeout ?? 8000,
          maxBuffer: 1024 * 1024,
          windowsHide: true,
          signal: options.signal
            ? AbortSignal.any([lifetime, options.signal])
            : lifetime,
        },
        (error, stdout, stderr) => {
          if (!error) return resolve(stdout.trim());
          if (args[0] === "pair")
            return reject(
              new Error(
                "ADB pairing failed. Check Wireless debugging and try a new QR code.",
              ),
            );
          if ((error as NodeJS.ErrnoException).code === "ENOENT")
            return reject(
              new Error(
                "ADB was not found. Install Android SDK Platform-Tools and restart the Paseo daemon.",
              ),
            );
          if (error.killed)
            return reject(
              new Error("ADB timed out. Check the device address and network."),
            );
          reject(
            new Error(
              (stderr || stdout || error.message).trim().slice(0, 1000),
            ),
          );
        },
      );
    });
}
export async function findAdb(signal: AbortSignal): Promise<string> {
  const executable = process.platform === "win32" ? "adb.exe" : "adb";
  const candidates = [
    process.env.ADB_PATH,
    ...[
      process.env.ANDROID_HOME,
      process.env.ANDROID_SDK_ROOT,
      join(homedir(), "Library", "Android", "sdk"),
      join(homedir(), "Android", "Sdk"),
      join(homedir(), "android-sdk"),
    ]
      .filter(Boolean)
      .map((root) => join(root!, "platform-tools", executable)),
    executable,
  ].filter((value): value is string => Boolean(value));
  for (const candidate of [...new Set(candidates)]) {
    if (signal.aborted) throw new Error("Plugin stopped.");
    try {
      if (candidate !== executable) await access(candidate, constants.X_OK);
      const version = await createRunner(candidate, signal)(["version"]);
      if (version.includes("Android Debug Bridge")) return candidate;
    } catch {
      /* Try the next standard SDK location. */
    }
  }
  throw new Error(
    "ADB was not found. Install Android SDK Platform-Tools, set ADB_PATH or ANDROID_HOME if needed, then reload this plugin.",
  );
}
export class AdbClient {
  constructor(
    readonly path: string,
    private readonly run: CommandRunner,
  ) {}
  async devices(): Promise<Device[]> {
    const devices = parseDevices(await this.run(["devices", "-l"]));
    // Bound parallel property reads so a collection of offline devices cannot flood ADB.
    for (let i = 0; i < devices.length; i += 4) {
      await Promise.all(
        devices.slice(i, i + 4).map(async (device) => {
          if (device.state !== "device") return;
          try {
            const output = await this.run(
              ["-s", device.serial, "shell", "getprop"],
              { timeout: 3000 },
            );
            const properties = Object.fromEntries(
              [...output.matchAll(/^\[([^\]]+)\]: \[([^\]]*)\]$/gm)].map(
                (m) => [m[1], m[2]],
              ),
            );
            if (properties["ro.product.manufacturer"])
              device.manufacturer = properties["ro.product.manufacturer"];
            if (properties["ro.product.model"])
              device.model = properties["ro.product.model"];
            if (properties["ro.build.version.release"])
              device.androidVersion = properties["ro.build.version.release"];
          } catch {
            /* A transport can disappear between listing and reading its properties. */
          }
        }),
      );
    }
    return devices;
  }
  async connect(value: string, signal?: AbortSignal): Promise<string> {
    const { address } = parseEndpoint(value);
    const output = await this.run(["connect", address], { signal });
    if (!/^(?:already )?connected to /im.test(output))
      throw new Error(output || "ADB could not connect to this device.");
    return output;
  }
  async disconnect(serial: string): Promise<string> {
    const devices = parseDevices(await this.run(["devices", "-l"]));
    if (!devices.some((d) => d.serial === serial && d.network))
      throw new Error("Only listed network devices can be disconnected.");
    const output = await this.run(["disconnect", serial]);
    if (!/^disconnected /im.test(output))
      throw new Error(output || "ADB could not disconnect this device.");
    return output;
  }
  async services(signal?: AbortSignal) {
    const output = await this.run(["mdns", "services"], { signal });
    if (/error:|unknown command|not supported|mdns.*unavailable/i.test(output))
      throw new Error(
        "ADB mDNS discovery is unavailable. Update Platform-Tools and check the local network.",
      );
    return parseServices(output);
  }
  async pair(
    address: string,
    password: string,
    signal?: AbortSignal,
  ): Promise<string> {
    const output = await this.run(
      ["pair", parseEndpoint(address).address, password],
      { signal, timeout: 15000 },
    );
    if (!/^Successfully paired/im.test(output))
      throw new Error(
        "ADB pairing failed. Generate a new QR code and scan it from Wireless debugging.",
      );
    return output;
  }
}
