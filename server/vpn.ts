import type { DeviceVpn } from "../shared/contracts";
import { ipSchema } from "../shared/endpoint";
import type { CommandRunner } from "./adb";

const vpnApps = new Map<string, DeviceVpn["provider"]>([
  ["com.tailscale.ipn", "Tailscale"],
  ["com.wireguard.android", "WireGuard"],
  ["com.zerotier.one", "ZeroTier"],
  ["io.netbird.client", "NetBird"],
]);

export async function detectVpn(
  run: CommandRunner,
  serial: string,
): Promise<DeviceVpn | undefined> {
  const shell = ["-s", serial, "shell"];
  const output = await run(
    [...shell, "dumpsys", "-t", "3", "connectivity", "--short"],
    { timeout: 4000 },
  );
  const lines = output.split(/\r?\n/);
  const start = lines.findIndex((line) => line.trim() === "Current Networks:");
  if (start === -1) return;
  const candidates: { uid: string; host: string }[] = [];
  for (const line of lines.slice(start + 1)) {
    if (/^\S/.test(line)) break;
    if (!/^\s+NetworkAgentInfo\b/.test(line)) continue;
    const transports = /\bTransports: ([A-Z0-9_|&]+)/.exec(line)?.[1];
    if (!transports?.split(/[|&]/).includes("VPN")) continue;
    const uid = /\b(?:OwnerUid|EstablishingAppUid): (\d+)\b/.exec(line)?.[1];
    const addresses = /\bLinkAddresses: \[([^\]]*)\]/.exec(line)?.[1];
    if (!uid || !addresses) continue;
    const hosts = addresses
      .split(/[\s,]+/)
      .map((address) => address.trim().split("/")[0].toLowerCase())
      .filter(
        (host) =>
          ipSchema.safeParse(host).success &&
          !/^(?:0\.|127\.|169\.254\.|::(?:1)?$|fe[89ab][\da-f]:|ff[\da-f]{2}:)/.test(
            host,
          ),
      );
    const host = hosts.find((ip) => !ip.includes(":")) ?? hosts[0];
    if (host) candidates.push({ uid, host });
  }
  if (!candidates.length) return;

  // Match the live VPN network's owner to its app. Installed apps can be idle.
  const packages = await run([...shell, "pm", "list", "packages", "-U"], {
    timeout: 3000,
  });
  const owners = new Map<string, DeviceVpn["provider"]>();
  for (const [, pkg, uid] of packages.matchAll(
    /^package:(\S+)\s+uid:(\d+)\s*$/gm,
  )) {
    const provider = vpnApps.get(pkg);
    if (provider) owners.set(uid, provider);
  }
  for (const { uid, host } of candidates) {
    const provider = owners.get(uid);
    if (provider) return { provider, host };
  }
}
