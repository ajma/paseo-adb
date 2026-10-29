import type { PluginServerContext } from "@getpaseo/plugin/server";
import { homedir } from "node:os";
import { join } from "node:path";
import {
  devicesRpc,
  connectRpc,
  disconnectRpc,
  inputTextRpc,
  textHistoryRpc,
  removeTextHistoryRpc,
  historyRpc,
  removeHistoryRpc,
  startPairingRpc,
  pairWithCodeRpc,
  pairingStatusRpc,
  cancelPairingRpc,
} from "./shared/contracts";
import { parseEndpoint } from "./shared/endpoint";
import { AdbClient, createRunner, findAdb } from "./server/adb";
import { HistoryStore } from "./server/history";
import { PairingManager } from "./server/pairing";
import { TextHistoryStore, sendTextWithHistory } from "./server/text-history";
import { pairWithCode } from "./server/manual-pairing";

export default function contribute(server: PluginServerContext) {
  const lifetime = new AbortController();
  const history = new HistoryStore(
    join(
      process.env.PASEO_HOME || join(homedir(), ".paseo"),
      "plugin-data",
      "adb",
      "history.json",
    ),
  );
  const textHistory = new TextHistoryStore(
    join(
      process.env.PASEO_HOME || join(homedir(), ".paseo"),
      "plugin-data",
      "adb",
      "text-history.json",
    ),
  );
  let backend: Promise<{ adb: AdbClient; pairing: PairingManager }> | undefined;
  let pairing: PairingManager | undefined;
  const getBackend = () =>
    (backend ??= findAdb(lifetime.signal)
      .then((path) => {
        const adb = new AdbClient(path, createRunner(path, lifetime.signal));
        pairing = new PairingManager(adb, history);
        return { adb, pairing };
      })
      .catch((error) => {
        backend = undefined;
        throw error;
      }));

  server.handle(devicesRpc, async () => {
    const { adb } = await getBackend();
    const devices = await adb.devices();
    try {
      await history.rememberDevices(devices);
    } catch {
      // Saved descriptions are optional; history failures must not hide devices.
    }
    return { devices, adbPath: adb.path };
  });
  server.handle(connectRpc, async ({ endpoint }) => {
    const target = parseEndpoint(endpoint);
    const { adb } = await getBackend();
    const message = await adb.connect(target.address);
    try {
      await history.add(target.host);
      return { message };
    } catch {
      return {
        message,
        warning: "Connected, but this IP could not be saved to history.",
      };
    }
  });
  server.handle(disconnectRpc, async ({ serial }) => ({
    message: await (await getBackend()).adb.disconnect(serial),
  }));
  server.handle(inputTextRpc, async (input) =>
    sendTextWithHistory((await getBackend()).adb, textHistory, input),
  );
  server.handle(textHistoryRpc, () => textHistory.list());
  server.handle(removeTextHistoryRpc, async ({ text }) => {
    await textHistory.remove(text);
    return {};
  });
  server.handle(historyRpc, () => history.entries());
  server.handle(removeHistoryRpc, async ({ host }) => {
    await history.remove(host);
    return {};
  });
  server.handle(startPairingRpc, async () =>
    (await getBackend()).pairing.start(),
  );
  server.handle(pairWithCodeRpc, async (input) =>
    pairWithCode((await getBackend()).adb, history, input),
  );
  server.handle(pairingStatusRpc, () => pairing?.status() ?? null);
  server.handle(cancelPairingRpc, ({ id }) => {
    pairing?.cancel(id);
    return {};
  });
  return () => {
    pairing?.dispose();
    lifetime.abort();
  };
}
