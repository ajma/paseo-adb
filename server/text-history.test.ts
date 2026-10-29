import { afterEach, expect, it } from "vitest";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { TextHistoryStore, sendTextWithHistory } from "./text-history";

const dirs: string[] = [];
async function historyFile() {
  const dir = await mkdtemp(join(tmpdir(), "paseo-adb-text-history-"));
  dirs.push(dir);
  return join(dir, "text-history.json");
}
afterEach(async () => {
  await Promise.all(
    dirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })),
  );
});

it("persists recent distinct strings exactly, evicts oldest entries, and serializes edits", async () => {
  const file = await historyFile();
  const store = new TextHistoryStore(file);
  expect(await store.list()).toEqual([]);
  await Promise.all(
    Array.from({ length: 21 }, (_, i) => store.add(`text ${i}`)),
  );
  await store.add("  It's literal & %s  ");
  await store.add("text 10");
  const saved = await new TextHistoryStore(file).list();
  expect(saved).toHaveLength(20);
  expect(saved.slice(0, 3)).toEqual([
    "text 10",
    "  It's literal & %s  ",
    "text 20",
  ]);
  expect(saved).not.toContain("text 0");
  expect(saved.filter((text) => text === "text 10")).toHaveLength(1);
  await store.remove("  It's literal & %s  ");
  expect(await new TextHistoryStore(file).list()).not.toContain(
    "  It's literal & %s  ",
  );
});

it("saves only successful sends and reports a history write failure as a warning", async () => {
  const file = await historyFile();
  const store = new TextHistoryStore(file);
  const adb = { inputText: async () => "Text sent." };
  await sendTextWithHistory(adb, store, { serial: "USB", text: "sent" });
  expect(await store.list()).toEqual(["sent"]);
  await expect(
    sendTextWithHistory(
      {
        inputText: async () => {
          throw new Error("offline");
        },
      },
      store,
      { serial: "USB", text: "failed" },
    ),
  ).rejects.toThrow("offline");
  expect(await store.list()).toEqual(["sent"]);
  await writeFile(file, "{broken");
  const result = await sendTextWithHistory(adb, store, {
    serial: "USB",
    text: "still sent",
  });
  expect(result.message).toBe("Text sent.");
  expect(result.warning).toContain("could not be saved");
  expect(await readFile(file, "utf8")).toBe("{broken");
});
