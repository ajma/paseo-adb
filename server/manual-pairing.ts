import type { AdbClient } from "./adb";
import type { HistoryStore } from "./history";
import { historyPrefix } from "../shared/endpoint";
import {
  manualPairingInputSchema,
  type ManualPairingInput,
} from "../shared/manual-pairing";

const normalizedHost = (host: string) =>
  new URL(`http://${historyPrefix(host)}1`).hostname;

export async function pairWithCode(
  adb: Pick<AdbClient, "pair" | "services" | "connect">,
  history: Pick<HistoryStore, "add">,
  value: ManualPairingInput,
): Promise<{ message: string; connected: boolean; warning?: string }> {
  const { host, port, code } = manualPairingInputSchema.parse(value);
  await adb.pair(historyPrefix(host) + port, code);
  // Pairing and connection use different ports. Discovery is optional once the
  // device trusts this host, so failures here must not report pairing failure.
  let connected = false;
  try {
    const services = await adb.services();
    for (const service of services) {
      if (
        service.type !== "_adb-tls-connect._tcp" ||
        normalizedHost(service.host) !== normalizedHost(host)
      )
        continue;
      try {
        await adb.connect(service.address);
        connected = true;
        break;
      } catch {
        // Another advertised connection endpoint may still be reachable.
      }
    }
  } catch {
    // mDNS may be unavailable even though code pairing succeeded.
  }
  if (!connected)
    return {
      connected: false,
      message:
        "Device paired. To connect, use the IP and port from the main Wireless debugging screen in Connect a device. The pairing port is different.",
    };
  const result = { connected: true, message: "Device paired and connected." };
  try {
    await history.add(host);
    return result;
  } catch {
    return {
      ...result,
      warning: "Connected, but this IP could not be saved to history.",
    };
  }
}
