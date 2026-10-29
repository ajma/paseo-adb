// @vitest-environment jsdom
import React from "react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import {
  cleanup,
  act,
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
  api.handlers.set("adb.history", async () => [
    { host: "192.168.1.80", description: "Google Pixel 6" },
  ]);
  api.handlers.set("adb.pairing.status", async () => null);
  api.handlers.set("adb.history.remove", async () => ({}));
  api.handlers.set("adb.disconnect", async () => ({ message: "disconnected" }));
  api.handlers.set("adb.pairing.cancel", async () => ({}));
  api.handlers.set("adb.input.history", async () => []);
  api.handlers.set("adb.input.history.remove", async () => ({}));
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
  expect(
    await screen.findByRole("button", {
      name: "Disconnect 192.168.1.80:40123",
    }),
  ).toBeTruthy();
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

function textDevices() {
  api.handlers.set("adb.devices", async () => ({
    devices: [
      { serial: "USB", state: "device", network: false },
      { serial: "192.168.1.2:5555", state: "device", network: true },
      { serial: "OFFLINE", state: "offline", network: false },
    ],
    adbPath: "/sdk/adb",
  }));
}

it("sends text from the compact screen to the chosen device and keeps the draft", async () => {
  textDevices();
  const send = vi.fn(async () => ({ message: "Text sent." }));
  api.handlers.set("adb.input.text", send);
  openScreen();
  fireEvent.click(
    await screen.findByRole("button", {
      name: "Send text to 192.168.1.2:5555",
    }),
  );
  const input = screen.getByLabelText(
    "Text to send to 192.168.1.2:5555",
  ) as HTMLInputElement;
  const text = "  It's a test & %s  ";
  fireEvent.change(input, { target: { value: text } });
  fireEvent.click(screen.getByRole("button", { name: "Send text" }));
  await waitFor(() =>
    expect(send).toHaveBeenCalledExactlyOnceWith({
      serial: "192.168.1.2:5555",
      text,
    }),
  );
  expect(await screen.findByText("Text sent.")).toBeTruthy();
  expect(input.value).toBe(text);
  fireEvent.change(input, { target: { value: "next text" } });
  expect(screen.queryByText("Text sent.")).toBeNull();
  expect(
    screen.queryByRole("button", { name: "Send text to OFFLINE" }),
  ).toBeNull();
});

it("validates text, prevents duplicate sends, and preserves text on failure", async () => {
  textDevices();
  let rejectSend!: (error: Error) => void;
  const send = vi.fn(
    () =>
      new Promise((_, reject) => {
        rejectSend = reject;
      }),
  );
  api.handlers.set("adb.input.text", send);
  openScreen();
  fireEvent.click(
    await screen.findByRole("button", { name: "Send text to USB" }),
  );
  const input = screen.getByLabelText(
    "Text to send to USB",
  ) as HTMLInputElement;
  expect(
    screen
      .getByRole("button", { name: "Send text" })
      .getAttribute("aria-disabled"),
  ).toBe("true");
  fireEvent.change(input, { target: { value: "hello 😀" } });
  fireEvent.click(screen.getByRole("button", { name: "Send text" }));
  expect(screen.getByRole("alert").textContent).toContain("Unicode");
  expect(send).not.toHaveBeenCalled();
  fireEvent.change(input, { target: { value: "hello" } });
  const button = screen.getByRole("button", { name: "Send text" });
  fireEvent.click(button);
  fireEvent.click(button);
  await waitFor(() => expect(send).toHaveBeenCalledTimes(1));
  expect(
    screen
      .getByRole("button", { name: "Sending…" })
      .getAttribute("aria-disabled"),
  ).toBe("true");
  expect(input.readOnly).toBe(true);
  rejectSend(new Error("device went offline"));
  expect(await screen.findByRole("alert")).toHaveProperty(
    "textContent",
    "device went offline",
  );
  expect(input.value).toBe("hello");
  expect(send).toHaveBeenCalledTimes(1);
  fireEvent.click(screen.getByRole("button", { name: "Close" }));
  expect(screen.queryByLabelText("Text to send to USB")).toBeNull();
});

it("shows sent strings on focus and fills the draft without sending", async () => {
  textDevices();
  const send = vi.fn(async () => ({ message: "Text sent." }));
  api.handlers.set("adb.input.text", send);
  api.handlers.set("adb.input.history", async () => [
    "  previous text  ",
    "another string",
  ]);
  openScreen();
  fireEvent.click(
    await screen.findByRole("button", { name: "Send text to USB" }),
  );
  const input = screen.getByLabelText(
    "Text to send to USB",
  ) as HTMLInputElement;
  expect(
    screen.queryByRole("button", { name: "Use text: previous text" }),
  ).toBeNull();
  fireEvent.focus(input);
  const suggestion = await screen.findByRole("button", {
    name: "Use text: previous text",
  });
  // A pointer press blurs the field before the row's press completes.
  fireEvent.blur(input);
  fireEvent.mouseDown(suggestion);
  fireEvent.mouseUp(suggestion);
  fireEvent.click(suggestion);
  expect(input.value).toBe("  previous text  ");
  expect(send).not.toHaveBeenCalled();
  // Tab navigation transfers focus into the history rather than closing it.
  const nextSuggestion = screen.getByRole("button", {
    name: "Use text: another string",
  });
  act(() => {
    nextSuggestion.focus();
  });
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 200));
  });
  expect(
    screen.getByRole("button", { name: "Use text: another string" }),
  ).toBeTruthy();
  act(() => {
    screen.getByRole("button", { name: "Remove text: another string" }).focus();
  });
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 200));
  });
  expect(
    screen.getByRole("button", { name: "Use text: another string" }),
  ).toBeTruthy();
  act(() => {
    screen.getByLabelText("IP:port").focus();
  });
  await waitFor(() =>
    expect(
      screen.queryByRole("button", { name: "Use text: another string" }),
    ).toBeNull(),
  );
});

it("removes a history string without changing the draft and keeps it removed on refocus", async () => {
  textDevices();
  let entries = ["remove me", "keep me"];
  api.handlers.set("adb.input.history", async () => [...entries]);
  api.handlers.set("adb.input.history.remove", async (input) => {
    entries = entries.filter(
      (text) => text !== (input as { text: string }).text,
    );
    return {};
  });
  openScreen();
  fireEvent.click(
    await screen.findByRole("button", { name: "Send text to USB" }),
  );
  const input = screen.getByLabelText(
    "Text to send to USB",
  ) as HTMLInputElement;
  fireEvent.change(input, { target: { value: "draft" } });
  fireEvent.focus(input);
  fireEvent.click(
    await screen.findByRole("button", { name: "Remove text: remove me" }),
  );
  await waitFor(() =>
    expect(
      screen.queryByRole("button", { name: "Use text: remove me" }),
    ).toBeNull(),
  );
  expect(input.value).toBe("draft");
  expect(
    screen.getByRole("button", { name: "Use text: keep me" }),
  ).toBeTruthy();
  fireEvent.blur(input);
  fireEvent.focus(input);
  expect(
    await screen.findByRole("button", { name: "Use text: keep me" }),
  ).toBeTruthy();
  expect(
    screen.queryByRole("button", { name: "Use text: remove me" }),
  ).toBeNull();
});

it("refreshes history after sending and shows deletion errors without losing an entry", async () => {
  textDevices();
  let entries: string[] = [];
  api.handlers.set("adb.input.history", async () => [...entries]);
  api.handlers.set("adb.input.text", async (input) => {
    entries = [(input as { text: string }).text];
    return { message: "Text sent." };
  });
  api.handlers.set("adb.input.history.remove", async () => {
    throw new Error("Could not remove saved text");
  });
  openScreen();
  fireEvent.click(
    await screen.findByRole("button", { name: "Send text to USB" }),
  );
  const input = screen.getByLabelText("Text to send to USB");
  fireEvent.focus(input);
  fireEvent.change(input, { target: { value: "new text" } });
  fireEvent.click(screen.getByRole("button", { name: "Send text" }));
  fireEvent.focus(input);
  fireEvent.click(
    await screen.findByRole("button", { name: "Remove text: new text" }),
  );
  expect(await screen.findByText("Could not remove saved text")).toBeTruthy();
  expect(
    screen.getByRole("button", { name: "Use text: new text" }),
  ).toBeTruthy();
});
