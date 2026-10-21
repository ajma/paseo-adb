import { afterEach, it, expect, vi } from "vitest";
import { PairingManager } from "./pairing";
import type { Service } from "./parsers";
const pairing = (name: string): Service => ({
  name,
  type: "_adb-tls-pairing._tcp",
  host: "192.168.1.2",
  port: 30000,
  address: "192.168.1.2:30000",
});
const connect: Service = {
  name: "adb-ABC",
  type: "_adb-tls-connect._tcp",
  host: "192.168.1.2",
  port: 40000,
  address: "192.168.1.2:40000",
};
afterEach(() => vi.useRealTimers());

it("pairs only the QR service and uses a separate connect port", async () => {
  vi.useFakeTimers();
  let name = "";
  const calls: string[][] = [];
  const history: string[] = [];
  const manager = new PairingManager(
    {
      services: async () => [
        pairing("studio-someone-else"),
        pairing(name),
        connect,
      ],
      pair: async (address, password) => {
        calls.push(["pair", address, password]);
        return "Successfully paired";
      },
      connect: async (address) => {
        calls.push(["connect", address]);
        return "connected";
      },
    },
    {
      add: async (host) => {
        history.push(host);
      },
    },
    async (payload) => {
      name = /S:([^;]+)/.exec(payload)![1];
      expect(payload).toMatch(/^WIFI:T:ADB;S:studio-[a-f0-9]+;P:[a-f0-9]+;;$/);
      return "data:image/png;base64,test";
    },
  );
  await manager.start();
  await vi.advanceTimersByTimeAsync(2000);
  expect(manager.status()?.phase).toBe("connected");
  expect(calls[0].slice(0, 2)).toEqual(["pair", "192.168.1.2:30000"]);
  expect(calls[1]).toEqual(["connect", "192.168.1.2:40000"]);
  expect(history).toEqual(["192.168.1.2"]);
  expect(manager.status()?.qr).toBeUndefined();
  manager.dispose();
});
it("expires after two minutes without a matching service", async () => {
  vi.useFakeTimers();
  const manager = new PairingManager(
    { services: async () => [], pair: async () => "", connect: async () => "" },
    { add: async () => {} },
    async () => "qr",
  );
  await manager.start();
  await vi.advanceTimersByTimeAsync(120001);
  expect(manager.status()?.phase).toBe("expired");
  manager.dispose();
});
it("a late canceled pair cannot connect or replace a new session", async () => {
  vi.useFakeTimers();
  let name = "";
  let finish!: (value: string) => void;
  let connects = 0;
  const manager = new PairingManager(
    {
      services: async () => [pairing(name), connect],
      pair: () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
      connect: async () => {
        connects++;
        return "connected";
      },
    },
    { add: async () => {} },
    async (payload) => {
      name = /S:([^;]+)/.exec(payload)![1];
      return "qr";
    },
  );
  const old = await manager.start();
  await vi.advanceTimersByTimeAsync(1500);
  manager.cancel(old.id);
  const next = await manager.start();
  finish("Successfully paired");
  await vi.advanceTimersByTimeAsync(0);
  expect(connects).toBe(0);
  expect(manager.status()?.id).toBe(next.id);
  expect(manager.status()?.phase).toBe("waiting");
  manager.dispose();
});
it("reports paired separately when discovery never yields the connection port", async () => {
  vi.useFakeTimers();
  let name = "";
  const manager = new PairingManager(
    {
      services: async () => [pairing(name)],
      pair: async () => "Successfully paired",
      connect: async () => "",
    },
    { add: async () => {} },
    async (payload) => {
      name = /S:([^;]+)/.exec(payload)![1];
      return "qr";
    },
  );
  await manager.start();
  await vi.advanceTimersByTimeAsync(120001);
  expect(manager.status()?.phase).toBe("paired");
  expect(manager.status()?.message).toMatch(/paste/i);
  manager.dispose();
});
