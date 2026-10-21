import { it, expect } from "vitest";
import { mkdtemp, readFile, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { HistoryStore } from "./history";
it("deduplicates and removes equivalent IPv6 spellings", async () => {
  const dir = await mkdtemp(join(tmpdir(), "paseo-adb-history-"));
  try {
    const store = new HistoryStore(join(dir, "history.json"));
    await store.add("2001:db8::1");
    await store.add("2001:0DB8:0:0:0:0:0:1");
    expect(await store.list()).toEqual(["2001:db8::1"]);
    await store.remove("2001:0db8:0:0:0:0:0:1");
    expect(await store.list()).toEqual([]);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
it("persists five distinct IPs and serializes concurrent mutations", async () => {
  const dir = await mkdtemp(join(tmpdir(), "paseo-adb-history-"));
  try {
    const file = join(dir, "history.json");
    const store = new HistoryStore(file);
    await Promise.all(
      [1, 2, 3, 4, 5, 6].map((n) => store.add("192.168.1." + n)),
    );
    await store.add("192.168.1.3");
    expect(await new HistoryStore(file).list()).toEqual([
      "192.168.1.3",
      "192.168.1.6",
      "192.168.1.5",
      "192.168.1.4",
      "192.168.1.2",
    ]);
    await store.remove("192.168.1.5");
    expect(await store.list()).not.toContain("192.168.1.5");
    expect(await readFile(file, "utf8")).not.toContain(":");
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
it("does not overwrite corrupted history", async () => {
  const dir = await mkdtemp(join(tmpdir(), "paseo-adb-history-"));
  try {
    const file = join(dir, "history.json");
    await writeFile(file, "{broken");
    const store = new HistoryStore(file);
    await expect(store.add("192.168.1.1")).rejects.toThrow(/history/i);
    expect(await readFile(file, "utf8")).toBe("{broken");
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
