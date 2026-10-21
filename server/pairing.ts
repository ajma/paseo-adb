import { randomBytes, randomUUID } from "node:crypto";
import QRCode from "qrcode";
import type { PairingState } from "../shared/contracts";
import type { AdbClient } from "./adb";
import type { HistoryStore } from "./history";

type Gateway = Pick<AdbClient, "services" | "pair" | "connect">;
type Session = {
  state: PairingState;
  controller: AbortController;
  timer: ReturnType<typeof setTimeout>;
  name: string;
  password: string;
  paired: boolean;
};
const activePhases = new Set(["waiting", "pairing", "connecting"]);
function sleep(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal.aborted) return reject(new Error("Canceled"));
    const end = () => {
      signal.removeEventListener("abort", abort);
      resolve();
    };
    const timer = setTimeout(end, ms);
    const abort = () => {
      clearTimeout(timer);
      signal.removeEventListener("abort", abort);
      reject(new Error("Canceled"));
    };
    signal.addEventListener("abort", abort, { once: true });
  });
}
export class PairingManager {
  private session?: Session;
  constructor(
    private readonly adb: Gateway,
    private readonly history: Pick<HistoryStore, "add">,
    private readonly render: (payload: string) => Promise<string> = (payload) =>
      QRCode.toDataURL(payload, {
        width: 280,
        margin: 4,
        errorCorrectionLevel: "M",
      }),
  ) {}
  status(): PairingState | null {
    return this.session ? { ...this.session.state } : null;
  }
  private active(session: Session): boolean {
    return (
      this.session === session &&
      !session.controller.signal.aborted &&
      activePhases.has(session.state.phase)
    );
  }
  private finish(
    session: Session,
    phase: PairingState["phase"],
    message: string,
  ) {
    if (this.session !== session) return;
    session.state = {
      id: session.state.id,
      expiresAt: session.state.expiresAt,
      phase,
      message,
    };
    session.password = "";
    clearTimeout(session.timer);
    session.controller.abort();
  }
  async start(): Promise<PairingState> {
    if (this.session) this.cancel(this.session.state.id);
    const state: PairingState = {
      id: randomUUID(),
      phase: "waiting",
      expiresAt: Date.now() + 120000,
      message: "Waiting for your phone to scan the QR code…",
    };
    const session: Session = {
      state,
      controller: new AbortController(),
      name: "studio-" + randomBytes(10).toString("hex"),
      password: randomBytes(16).toString("hex"),
      paired: false,
      timer: setTimeout(() => {
        if (!this.active(session)) return;
        this.finish(
          session,
          session.paired ? "paired" : "expired",
          session.paired
            ? "Paired successfully. Paste the IP:port from the main Wireless debugging screen to connect."
            : "QR code expired. Generate a new code and scan it from Wireless debugging. Check that the phone and daemon are on the same network and mDNS is allowed.",
        );
      }, 120000),
    };
    this.session = session;
    try {
      const qr = await this.render(
        `WIFI:T:ADB;S:${session.name};P:${session.password};;`,
      );
      if (!this.active(session))
        throw new Error("Pairing session was replaced or canceled.");
      session.state.qr = qr;
      // Return the QR promptly; all discovery and pairing happens in the background.
      void this.follow(session);
      return { ...session.state };
    } catch (error) {
      if (this.active(session))
        this.finish(
          session,
          "failed",
          "Could not generate the pairing QR code.",
        );
      throw error;
    }
  }
  cancel(id: string) {
    const session = this.session;
    if (session?.state.id === id && this.active(session))
      this.finish(session, "canceled", "Pairing canceled.");
  }
  dispose() {
    if (this.session) this.cancel(this.session.state.id);
  }
  private async follow(session: Session): Promise<void> {
    const signal = session.controller.signal;
    let pairedHost: string | undefined;
    try {
      while (this.active(session)) {
        await sleep(1000, signal);
        const services = await this.adb.services(signal);
        if (!this.active(session)) return;
        if (!session.paired) {
          const service = services.find(
            (s) =>
              s.type === "_adb-tls-pairing._tcp" && s.name === session.name,
          );
          if (!service) continue;
          session.state.phase = "pairing";
          session.state.message = "Phone found. Pairing…";
          await this.adb.pair(service.address, session.password, signal);
          if (!this.active(session)) return;
          session.paired = true;
          session.password = "";
          pairedHost = service.host;
          session.state.phase = "connecting";
          session.state.message = "Paired. Looking for the connection port…";
          delete session.state.qr;
        }
        for (const service of services.filter(
          (s) => s.type === "_adb-tls-connect._tcp" && s.host === pairedHost,
        )) {
          try {
            await this.adb.connect(service.address, signal);
          } catch {
            if (!this.active(session)) return;
            continue;
          }
          if (!this.active(session)) return;
          let message = "Device paired and connected.";
          try {
            await this.history.add(service.host);
          } catch {
            message += " Could not save this IP to history.";
          }
          if (this.active(session)) this.finish(session, "connected", message);
          return;
        }
      }
    } catch {
      if (this.active(session))
        this.finish(
          session,
          session.paired ? "paired" : "failed",
          session.paired
            ? "Paired successfully. Paste the connection IP:port from Wireless debugging to connect."
            : "Pairing could not finish. Check Wireless debugging, update Platform-Tools, and allow mDNS on the local network. Generate a new QR code to retry.",
        );
    }
  }
}
