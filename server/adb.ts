import { execFile } from "node:child_process";
import { access } from "node:fs/promises";
import { constants } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { VPN_ADB_PORT, type Device } from "../shared/contracts";
import { historyPrefix, parseEndpoint } from "../shared/endpoint";
import { parseDevices, parseServices } from "./parsers";
import { detectDeviceType } from "./device-type";
import { inputTextSchema } from "../shared/input-text";
import { detectVpn } from "./vpn";

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
                "ADB pairing failed. Check Wireless debugging and try a fresh pairing code or QR code.",
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
  private readonly switchingToVpn = new Set<string>();

  constructor(
    readonly path: string,
    private readonly run: CommandRunner,
  ) {}
  async devices(): Promise<Device[]> {
    const devices = parseDevices(await this.run(["devices", "-l"]));
    const online = new Set(
      devices
        .filter((device) => device.state === "device")
        .map((device) => device.serial),
    );
    // Bound parallel property reads so a collection of offline devices cannot flood ADB.
    for (let i = 0; i < devices.length; i += 4) {
      await Promise.all(
        devices.slice(i, i + 4).map(async (device) => {
          if (device.state !== "device") return;
          const vpn = device.usb
            ? detectVpn(this.run, device.serial).catch(() => undefined)
            : undefined;
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
            const hardwareSerial = [
              properties["ro.serialno"],
              properties["ro.boot.serialno"],
            ]
              .map((value) => value?.trim())
              .find((value) => value && value.toLowerCase() !== "unknown");
            // Emulator builds can share hardware serials; retain their transport identity.
            if (hardwareSerial && !device.serial.startsWith("emulator-"))
              device.hardwareSerial = hardwareSerial;
            if (properties["ro.product.manufacturer"])
              device.manufacturer = properties["ro.product.manufacturer"];
            if (properties["ro.product.model"])
              device.model = properties["ro.product.model"];
            if (properties["ro.build.version.release"])
              device.androidVersion = properties["ro.build.version.release"];
            device.deviceType = detectDeviceType(device.serial, properties);
            if (
              device.deviceType === "unknown" ||
              device.deviceType === "emulator"
            ) {
              try {
                const features = await this.run(
                  ["-s", device.serial, "shell", "pm", "list", "features"],
                  { timeout: 2000 },
                );
                device.deviceType = detectDeviceType(
                  device.serial,
                  properties,
                  features,
                );
              } catch {
                // Metadata remains useful when the package manager is unavailable.
              }
            }
          } catch {
            /* A transport can disappear between listing and reading its properties. */
          }
          const detectedVpn = await vpn;
          if (
            detectedVpn &&
            !online.has(historyPrefix(detectedVpn.host) + VPN_ADB_PORT)
          )
            device.vpn = detectedVpn;
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
  async switchToVpn(serial: string, host: string) {
    if (this.switchingToVpn.has(serial))
      throw new Error("This device is already switching to VPN ADB.");
    this.switchingToVpn.add(serial);
    try {
      const devices = parseDevices(await this.run(["devices", "-l"]));
      if (
        !devices.some(
          (device) =>
            device.serial === serial && device.usb && device.state === "device",
        )
      )
        throw new Error("Choose a connected, authorized USB device.");

      const vpn = await detectVpn(this.run, serial);
      if (!vpn)
        throw new Error(
          "Connect a supported VPN on the Android device and try again.",
        );
      if (vpn.host !== host)
        throw new Error("The VPN address changed. Refresh and try again.");
      const target = parseEndpoint(historyPrefix(vpn.host) + VPN_ADB_PORT);

      if (
        !devices.some(
          (device) =>
            device.serial === target.address && device.state === "device",
        )
      ) {
        const output = await this.run([
          "-s",
          serial,
          "tcpip",
          String(target.port),
        ]);
        if (
          !output
            .split(/\r?\n/)
            .includes(`restarting in TCP mode port: ${target.port}`)
        )
          throw new Error(output || "ADB could not enable TCP mode.");

        // adbd can acknowledge TCP mode before the new listener is ready.
        for (let attempt = 1; ; attempt++) {
          try {
            await this.connect(target.address);
            break;
          } catch (error) {
            if (attempt === 4 || !/connection refused/i.test(String(error)))
              throw error;
            await delay(400 * attempt);
          }
        }
        try {
          await this.run(["-s", target.address, "wait-for-device"], {
            timeout: 5000,
          });
        } catch (error) {
          throw new Error(
            `ADB at ${target.address} did not become ready. Check the VPN connection and approve any debugging prompt on Android.`,
            { cause: error },
          );
        }
      }

      return {
        target,
        message: `Connected over ${vpn.provider} at ${target.address}. You can unplug USB.`,
      };
    } finally {
      this.switchingToVpn.delete(serial);
    }
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
  async inputText(serial: string, value: string): Promise<string> {
    const text = inputTextSchema.parse(value);
    const devices = parseDevices(await this.run(["devices", "-l"]));
    if (!devices.some((d) => d.serial === serial && d.state === "device"))
      throw new Error("Choose a connected, authorized device to send text.");

    // ADB joins shell arguments before the device shell parses them. Quote for
    // that shell too, preserving spaces and treating punctuation as literal text.
    // Android expands %s to a space, so split that sequence across input calls.
    const command = text
      .split(/(?<=%)(?=s)/)
      .map((part) => `input text '${part.replace(/'/g, "'\\''")}'`)
      .join(" && ");
    await this.run(["-s", serial, "shell", command], { timeout: 30000 });
    return "Text sent. Check the focused field on the device.";
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
        "ADB pairing failed. Check Wireless debugging and try a fresh pairing code or QR code.",
      );
    return output;
  }
}
