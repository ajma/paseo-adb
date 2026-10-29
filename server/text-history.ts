import { mkdir, readFile, writeFile, rename } from "node:fs/promises";
import { dirname } from "node:path";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { inputTextSchema, MAX_TEXT_HISTORY } from "../shared/input-text";
import type { AdbClient } from "./adb";

const schema = z.array(inputTextSchema).max(MAX_TEXT_HISTORY);

export class TextHistoryStore {
  private queue: Promise<unknown> = Promise.resolve();
  constructor(private readonly file: string) {}
  private async read(): Promise<string[]> {
    try {
      return [
        ...new Set(schema.parse(JSON.parse(await readFile(this.file, "utf8")))),
      ];
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return [];
      throw new Error(
        "Could not read saved text history. The existing file was preserved.",
        { cause: error },
      );
    }
  }
  async list(): Promise<string[]> {
    await this.queue;
    return this.read();
  }
  private update(change: (entries: string[]) => string[]): Promise<void> {
    const job = this.queue.then(async () => {
      const entries = change(await this.read());
      await mkdir(dirname(this.file), { recursive: true, mode: 0o700 });
      const temp = this.file + "." + randomUUID() + ".tmp";
      await writeFile(temp, JSON.stringify(entries) + "\n", { mode: 0o600 });
      await rename(temp, this.file);
    });
    this.queue = job.catch(() => {});
    return job;
  }
  add(text: string): Promise<void> {
    const valid = inputTextSchema.parse(text);
    return this.update((entries) =>
      [valid, ...entries.filter((entry) => entry !== valid)].slice(
        0,
        MAX_TEXT_HISTORY,
      ),
    );
  }
  remove(text: string): Promise<void> {
    const valid = inputTextSchema.parse(text);
    return this.update((entries) => entries.filter((entry) => entry !== valid));
  }
}

export async function sendTextWithHistory(
  adb: Pick<AdbClient, "inputText">,
  history: TextHistoryStore,
  { serial, text }: { serial: string; text: string },
): Promise<{ message: string; warning?: string }> {
  const message = await adb.inputText(serial, text);
  try {
    await history.add(text);
    return { message };
  } catch {
    return {
      message,
      warning: "Text sent, but it could not be saved to history.",
    };
  }
}
