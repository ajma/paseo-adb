// @vitest-environment jsdom
import React from "react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { PluginScreenProps } from "@getpaseo/plugin/client";
import { AdbScreen } from "./screen";
import type { Device } from "../shared/contracts";

const api = vi.hoisted(() => ({
  handlers: new Map<string, (value: unknown) => Promise<unknown>>(),
}));
vi.mock("@getpaseo/plugin/client", () => ({
  useRpc: (contract: { name: string }) => api.handlers.get(contract.name),
}));
const props = {
  theme: {
    colors: {
      foreground: "#eee",
      foregroundMuted: "#aaa",
      surface0: "#111",
      surface1: "#222",
      surface2: "#333",
      border: "#444",
      accent: "#8cf",
      accentForeground: "#111",
      statusDanger: "#f88",
    },
  },
  layout: { compact: true, platform: "web" },
} as unknown as PluginScreenProps;
const clients: QueryClient[] = [];
function openScreen() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  clients.push(client);
  return render(
    <QueryClientProvider client={client}>
      <AdbScreen {...props} />
    </QueryClientProvider>,
  );
}
beforeEach(() => {
  api.handlers.clear();
  api.handlers.set("adb.devices", async () => ({
    devices: [],
    adbPath: "/sdk/adb",
  }));
  api.handlers.set("adb.history", async () => ["192.168.1.80"]);
  api.handlers.set("adb.pairing.status", async () => null);
  api.handlers.set("adb.history.remove", async () => ({}));
  api.handlers.set("adb.disconnect", async () => ({ message: "disconnected" }));
  api.handlers.set("adb.pairing.cancel", async () => ({}));
});
afterEach(() => {
  cleanup();
  clients.splice(0).forEach((client) => client.clear());
});

it("wires the compact screen's history to a new-port connection and refreshes devices", async () => {
  let connected = "";
  let devices: Device[] = [];
  api.handlers.set("adb.devices", async () => ({
    devices,
    adbPath: "/sdk/adb",
  }));
  api.handlers.set("adb.connect", async (input) => {
    connected = (input as { endpoint: string }).endpoint;
    devices = [
      {
        serial: connected,
        state: "device",
        network: true,
        manufacturer: "Google",
        model: "Pixel 6",
      },
    ];
    return { message: "connected to " + connected };
  });
  openScreen();
  fireEvent.click(
    await screen.findByRole("button", { name: "Use 192.168.1.80" }),
  );
  const input = screen.getByLabelText("IP:port") as HTMLInputElement;
  expect(input.value).toBe("192.168.1.80:");
  fireEvent.change(input, { target: { value: "192.168.1.80:40123" } });
  fireEvent.click(screen.getByRole("button", { name: "Connect" }));
  await waitFor(() => expect(connected).toBe("192.168.1.80:40123"));
  expect(await screen.findByText("Google Pixel 6")).toBeTruthy();
});

it("shows the QR returned by the host and can cancel its session", async () => {
  let canceled = "";
  api.handlers.set("adb.pairing.start", async () => ({
    id: "session-1",
    phase: "waiting",
    qr: "data:image/png;base64,test",
    expiresAt: Date.now() + 120000,
    message: "Waiting for scan",
  }));
  api.handlers.set("adb.pairing.cancel", async (input) => {
    canceled = (input as { id: string }).id;
    return {};
  });
  openScreen();
  fireEvent.click(screen.getByRole("button", { name: "Generate QR code" }));
  expect(
    await screen.findByLabelText("Android wireless debugging pairing QR code"),
  ).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "Cancel pairing" }));
  await waitFor(() => expect(canceled).toBe("session-1"));
});

it("explains unavailable ADB without hiding the connection form", async () => {
  api.handlers.set("adb.devices", async () => {
    throw new Error("ADB was not found");
  });
  openScreen();
  expect(await screen.findByText("ADB was not found")).toBeTruthy();
  expect(screen.getByLabelText("IP:port")).toBeTruthy();
});
