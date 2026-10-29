import { z } from "zod";

export type Endpoint = { host: string; port: number; address: string };
export const ipSchema = z.union([z.ipv4(), z.ipv6()]);
export const ipHistoryEntrySchema = z.object({
  host: ipSchema,
  description: z.string().min(1).max(300).optional(),
});
export type IpHistoryEntry = z.infer<typeof ipHistoryEntrySchema>;
export function historyPrefix(host: string): string {
  return host.includes(":") ? `[${host}]:` : `${host}:`;
}
export function parseEndpoint(value: string): Endpoint {
  const match = /^(?:\[([^\]]+)\]|([^:\s]+)):(\d+)$/.exec(value.trim());
  if (!match)
    throw new Error("Enter an IP and port, for example 192.168.1.80:37123.");
  const host = (match[1] ?? match[2]).toLowerCase();
  if (!ipSchema.safeParse(host).success)
    throw new Error("Enter a valid IP address.");
  const port = Number(match[3]);
  if (!Number.isInteger(port) || port < 1 || port > 65535)
    throw new Error("Port must be between 1 and 65535.");
  return { host, port, address: historyPrefix(host) + port };
}
