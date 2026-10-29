import { expect, it, vi } from "vitest";
import { pairWithCode } from "./manual-pairing";

const input = { host: "192.168.1.2", port: 30000, code: "012345" };
const service = {
  name: "adb-phone",
  type: "_adb-tls-connect._tcp",
  host: "192.168.1.2",
  port: 40000,
  address: "192.168.1.2:40000",
};

it("pairs with the entered code and connects using the separate discovered port", async () => {
  const calls: string[][] = [];
  const result = await pairWithCode(
    {
      pair: async (address, code) => {
        calls.push(["pair", address, code]);
        return "Successfully paired";
      },
      services: async () => [
        { ...service, host: "192.168.1.99", address: "192.168.1.99:40000" },
        service,
      ],
      connect: async (address) => {
        calls.push(["connect", address]);
        return "connected";
      },
    },
    {
      add: async (host) => {
        calls.push(["history", host]);
      },
    },
    input,
  );
  expect(calls).toEqual([
    ["pair", "192.168.1.2:30000", "012345"],
    ["connect", "192.168.1.2:40000"],
    ["history", "192.168.1.2"],
  ]);
  expect(result.connected).toBe(true);
});

it.each(["missing", "discovery failure", "connection failure"])(
  "reports successful pairing when automatic connection is unavailable: %s",
  async (failure) => {
    const history = vi.fn(async () => {});
    const result = await pairWithCode(
      {
        pair: async () => "Successfully paired",
        services: async () => {
          if (failure === "discovery failure")
            throw new Error("mDNS unavailable");
          return failure === "missing" ? [] : [service];
        },
        connect: async () => {
          throw new Error("Connection refused");
        },
      },
      { add: history },
      input,
    );
    expect(result.connected).toBe(false);
    expect(result.message).toMatch(/paired/i);
    expect(result.message).toMatch(/main Wireless debugging/i);
    expect(history).not.toHaveBeenCalled();
  },
);

it("does not attempt connection or save history when the pairing code fails", async () => {
  const services = vi.fn(async () => []);
  const add = vi.fn(async () => {});
  await expect(
    pairWithCode(
      {
        pair: async () => {
          throw new Error("ADB pairing failed");
        },
        services,
        connect: async () => "",
      },
      { add },
      input,
    ),
  ).rejects.toThrow("ADB pairing failed");
  expect(services).not.toHaveBeenCalled();
  expect(add).not.toHaveBeenCalled();
});

it("matches equivalent IPv6 addresses without connecting to the pairing port", async () => {
  const connect = vi.fn(async () => "connected");
  await pairWithCode(
    {
      pair: async () => "Successfully paired",
      services: async () => [
        { ...service, host: "2001:db8::1", address: "[2001:db8::1]:40000" },
      ],
      connect,
    },
    { add: async () => {} },
    { ...input, host: "2001:0db8:0:0:0:0:0:1" },
  );
  expect(connect).toHaveBeenCalledExactlyOnceWith("[2001:db8::1]:40000");
});

it("keeps connection success when history cannot be saved", async () => {
  const result = await pairWithCode(
    {
      pair: async () => "paired",
      services: async () => [service],
      connect: async () => "connected",
    },
    {
      add: async () => {
        throw new Error("disk full");
      },
    },
    input,
  );
  expect(result.connected).toBe(true);
  expect(result.warning).toMatch(/history/i);
});

it.each([
  { ...input, host: "bad-ip" },
  { ...input, port: 0 },
  { ...input, port: 65536 },
  { ...input, code: "12345" },
  { ...input, code: "abcdef" },
])("rejects invalid pairing details before ADB is called", async (value) => {
  const pair = vi.fn(async () => "");
  await expect(
    pairWithCode(
      { pair, services: async () => [], connect: async () => "" },
      { add: async () => {} },
      value,
    ),
  ).rejects.toThrow();
  expect(pair).not.toHaveBeenCalled();
});
