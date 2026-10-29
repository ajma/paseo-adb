import { mkdir, readFile, writeFile, rename } from "node:fs/promises";
import { dirname } from "node:path";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import {
  ipSchema,
  ipHistoryEntrySchema,
  parseEndpoint,
  type IpHistoryEntry,
} from "../shared/endpoint";
import type { Device } from "../shared/contracts";

// Read the original IP-only format as well as entries with saved descriptions.
const schema = z
  .array(
    z.union([ipSchema.transform((host) => ({ host })), ipHistoryEntrySchema]),
  )
  .max(5);
function canonicalIp(value: string): string {
  const host = ipSchema.parse(value).toLowerCase();
  return host.includes(":")
    ? new URL(`http://[${host}]/`).hostname.slice(1, -1)
    : host;
}
export class HistoryStore {
  private queue: Promise<unknown> = Promise.resolve();
  constructor(private readonly file: string) {}
  private async read(): Promise<IpHistoryEntry[]> {
    try {
      const entries: IpHistoryEntry[] = [];
      for (const entry of schema.parse(
        JSON.parse(await readFile(this.file, "utf8")),
      )) {
        const host = canonicalIp(entry.host);
        if (!entries.some((saved) => saved.host === host))
          entries.push({ ...entry, host });
      }
      return entries;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return [];
      throw new Error(
        "Could not read saved IP history. The existing file was preserved.",
        { cause: error },
      );
    }
  }
  async list(): Promise<string[]> {
    return (await this.entries()).map((entry) => entry.host);
  }
  async entries(): Promise<IpHistoryEntry[]> {
    await this.queue;
    return this.read();
  }
  private update(
    change: (entries: IpHistoryEntry[]) => IpHistoryEntry[],
  ): Promise<void> {
    const job = this.queue.then(async () => {
      const previous = await this.read();
      const entries = change(previous);
      if (JSON.stringify(entries) === JSON.stringify(previous)) return;
      await mkdir(dirname(this.file), { recursive: true, mode: 0o700 });
      const temp = this.file + "." + randomUUID() + ".tmp";
      await writeFile(temp, JSON.stringify(entries) + "\n", { mode: 0o600 });
      await rename(temp, this.file);
    });
    this.queue = job.catch(() => {});
    return job;
  }
  add(host: string): Promise<void> {
    const valid = canonicalIp(host);
    return this.update((entries) =>
      [
        entries.find((entry) => entry.host === valid) ?? { host: valid },
        ...entries.filter((entry) => entry.host !== valid),
      ].slice(0, 5),
    );
  }
  remove(host: string): Promise<void> {
    const valid = canonicalIp(host);
    return this.update((entries) =>
      entries.filter((entry) => entry.host !== valid),
    );
  }
  rememberDevices(devices: Device[]): Promise<void> {
    const descriptions = new Map<string, string>();
    for (const device of devices) {
      if (!device.network || device.state !== "device" || !device.model)
        continue;
      try {
        const host = canonicalIp(parseEndpoint(device.serial).host);
        const description = [device.manufacturer, device.model]
          .filter(Boolean)
          .join(" ")
          .trim()
          .slice(0, 300);
        if (description) descriptions.set(host, description);
      } catch {
        // USB serials and mDNS service names do not contain an IP address.
      }
    }
    if (!descriptions.size) return Promise.resolve();
    return this.update((entries) =>
      entries.map((entry) => {
        const description = descriptions.get(entry.host);
        return description ? { ...entry, description } : entry;
      }),
    );
  }
}
