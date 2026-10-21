import { expect, it } from "vitest";
import { createRunner } from "./adb";

it("captures actual subprocess output without a shell", async () => {
  const lifetime = new AbortController();
  const output = await createRunner(
    process.execPath,
    lifetime.signal,
  )(["-e", "process.stdout.write(process.argv[1])", "literal;$(echo nope)"]);
  expect(output).toBe("literal;$(echo nope)");
});

it("terminates a command at its timeout", async () => {
  const lifetime = new AbortController();
  await expect(
    createRunner(process.execPath, lifetime.signal)(
      ["-e", "setInterval(() => {}, 1000)"],
      { timeout: 50 },
    ),
  ).rejects.toThrow(/timed out/i);
});

it("aborts in-flight subprocesses during plugin cleanup", async () => {
  const lifetime = new AbortController();
  const command = createRunner(
    process.execPath,
    lifetime.signal,
  )(["-e", "setInterval(() => {}, 1000)"]);
  lifetime.abort();
  await expect(command).rejects.toThrow(/abort/i);
});

it("explains a missing executable", async () => {
  const lifetime = new AbortController();
  await expect(
    createRunner(
      "/nonexistent/paseo-adb-test/adb",
      lifetime.signal,
    )(["devices"]),
  ).rejects.toThrow(/ADB was not found/i);
});
