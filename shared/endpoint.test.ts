import { describe, it, expect } from "vitest";
import { parseEndpoint, historyPrefix } from "./endpoint";
describe("endpoint input", () => {
  it("accepts a copied address with surrounding whitespace", () => {
    expect(parseEndpoint(" 192.168.1.80:37123\n")).toEqual({
      host: "192.168.1.80",
      port: 37123,
      address: "192.168.1.80:37123",
    });
  });
  it.each([
    "192.168.1.80:",
    "192.168.1.80",
    "192.168.1.80:0",
    "192.168.1.80:65536",
    "192.168.1.80:12x",
    "999.1.1.1:1234",
    "127.0.0.1:1234;echo hi",
    "-s:1234",
    "host:1234",
  ])("rejects invalid endpoint %s", (value) => {
    expect(() => parseEndpoint(value)).toThrow();
  });
  it("accepts bracketed IPv6 and produces the correct history prefix", () => {
    expect(parseEndpoint("[2001:db8::1]:1234")).toEqual({
      host: "2001:db8::1",
      port: 1234,
      address: "[2001:db8::1]:1234",
    });
    expect(historyPrefix("2001:db8::1")).toBe("[2001:db8::1]:");
    expect(historyPrefix("192.168.1.80")).toBe("192.168.1.80:");
  });
});
