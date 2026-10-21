import { mkdir, readFile, writeFile, rename } from "node:fs/promises";
import { dirname } from "node:path";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { ipSchema } from "../shared/endpoint";

const schema = z.array(ipSchema).max(5);
function canonicalIp(value: string): string {
  const host = ipSchema.parse(value).toLowerCase();
  return host.includes(":")
    ? new URL(`http://[${host}]/`).hostname.slice(1, -1)
    : host;
}
export class HistoryStore {
  private queue: Promise<unknown> = Promise.resolve();
  constructor(private readonly file: string) {}
  private async read(): Promise<string[]> {
    try {
      return [
        ...new Set(
          schema
            .parse(JSON.parse(await readFile(this.file, "utf8")))
            .map(canonicalIp),
        ),
      ];
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return [];
      throw new Error(
        "Could not read saved IP history. The existing file was preserved.",
        { cause: error },
      );
    }
  }
  async list(): Promise<string[]> {
    await this.queue;
    return this.read();
  }
  private update(change: (hosts: string[]) => string[]): Promise<void> {
    const job = this.queue.then(async () => {
      const hosts = change(await this.read());
      await mkdir(dirname(this.file), { recursive: true, mode: 0o700 });
      const temp = this.file + "." + randomUUID() + ".tmp";
      await writeFile(temp, JSON.stringify(hosts) + "\n", { mode: 0o600 });
      await rename(temp, this.file);
    });
    this.queue = job.catch(() => {});
    return job;
  }
  add(host: string): Promise<void> {
    const valid = canonicalIp(host);
    return this.update((hosts) =>
      [valid, ...hosts.filter((h) => h !== valid)].slice(0, 5),
    );
  }
  remove(host: string): Promise<void> {
    const valid = canonicalIp(host);
    return this.update((hosts) => hosts.filter((h) => h !== valid));
  }
}
