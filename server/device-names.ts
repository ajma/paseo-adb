import { mkdir, readFile, writeFile, rename } from "node:fs/promises";
import { dirname } from "node:path";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import type { Device } from "../shared/contracts";
import { deviceNameSchema, originalDeviceName } from "../shared/device-name";

const entrySchema = z.object({
  serial: z.string(),
  hardwareSerial: z.string().optional(),
  name: deviceNameSchema.min(1),
  originalName: z.string().min(1),
});
type Entry = z.infer<typeof entrySchema>;

function findEntry(entries: Entry[], device: Device): Entry | undefined {
  return entries.find((entry) =>
    device.hardwareSerial && entry.hardwareSerial
      ? entry.hardwareSerial === device.hardwareSerial
      : entry.serial === device.serial,
  );
}

export class DeviceNameStore {
  private queue: Promise<unknown> = Promise.resolve();
  constructor(private readonly file: string) {}

  private async read(): Promise<Entry[]> {
    try {
      return z
        .array(entrySchema)
        .parse(JSON.parse(await readFile(this.file, "utf8")));
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return [];
      throw new Error(
        "Could not read saved device names. The existing file was preserved.",
        { cause: error },
      );
    }
  }

  private update(change: (entries: Entry[]) => Entry[]): Promise<void> {
    const job = this.queue.then(async () => {
      const previous = await this.read();
      const entries = change(previous.map((entry) => ({ ...entry })));
      if (JSON.stringify(previous) === JSON.stringify(entries)) return;
      await mkdir(dirname(this.file), { recursive: true, mode: 0o700 });
      const temp = this.file + "." + randomUUID() + ".tmp";
      await writeFile(temp, JSON.stringify(entries) + "\n", { mode: 0o600 });
      await rename(temp, this.file);
    });
    this.queue = job.catch(() => {});
    return job;
  }

  rename(device: Device, value: string): Promise<void> {
    const name = deviceNameSchema.parse(value);
    return this.update((entries) => {
      const previous = findEntry(entries, device);
      const remaining = entries.filter((entry) => entry !== previous);
      return name
        ? [
            ...remaining,
            {
              serial: device.serial,
              hardwareSerial: device.hardwareSerial ?? previous?.hardwareSerial,
              name,
              originalName:
                previous?.originalName ?? originalDeviceName(device),
            },
          ]
        : remaining;
    });
  }

  async apply(devices: Device[]): Promise<Device[]> {
    let result: Device[] = [];
    await this.update((entries) => {
      result = devices.map((device) => {
        const entry = findEntry(entries, device);
        if (!entry) return device;
        // Remember the latest transport for temporarily offline devices, and
        // learn hardware identity after an unauthorized device is approved.
        entry.serial = device.serial;
        entry.hardwareSerial = device.hardwareSerial ?? entry.hardwareSerial;
        return {
          ...device,
          customName: entry.name,
          originalName: entry.originalName,
        };
      });
      return entries;
    });
    return result;
  }
}
