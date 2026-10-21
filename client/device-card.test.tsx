// @vitest-environment jsdom
import React from "react";
import { afterEach, it, expect } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import type { PluginTheme } from "@getpaseo/plugin";
import { DeviceCard } from "./device-card";
afterEach(cleanup);
const theme = {
  colors: {
    foreground: "#eee",
    foregroundMuted: "#aaa",
    surface1: "#222",
    border: "#444",
    accent: "#8cf",
    accentForeground: "#111",
  },
} as unknown as PluginTheme;
it("shows the manufacturer, model, Android version, and network disconnect action", () => {
  render(
    <DeviceCard
      theme={theme}
      device={{
        serial: "192.168.1.80:37123",
        state: "device",
        network: true,
        manufacturer: "Google",
        model: "Pixel 6",
        androidVersion: "16",
      }}
      pending={false}
      onDisconnect={() => {}}
    />,
  );
  expect(screen.getByText("Google Pixel 6")).toBeTruthy();
  expect(screen.getByText("Android 16")).toBeTruthy();
  expect(
    screen.getByRole("button", { name: "Disconnect 192.168.1.80:37123" }),
  ).toBeTruthy();
});
it("keeps unauthorized USB devices visible with authorization guidance", () => {
  render(
    <DeviceCard
      theme={theme}
      device={{ serial: "ABC", state: "unauthorized", network: false }}
      pending={false}
      onDisconnect={() => {}}
    />,
  );
  expect(screen.getByText("ABC")).toBeTruthy();
  expect(screen.getByText(/Approve the debugging prompt/)).toBeTruthy();
  expect(screen.queryByRole("button")).toBeNull();
});
