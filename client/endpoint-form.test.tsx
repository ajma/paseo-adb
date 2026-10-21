// @vitest-environment jsdom
import React from "react";
import { afterEach, it, expect, vi } from "vitest";
import { cleanup, render, fireEvent, screen } from "@testing-library/react";
import { EndpointForm } from "./endpoint-form";
import type { PluginTheme } from "@getpaseo/plugin";
afterEach(cleanup);
const theme = {
  colors: {
    foreground: "#eee",
    foregroundMuted: "#aaa",
    surface0: "#111",
    surface1: "#222",
    border: "#444",
    accent: "#8cf",
    accentForeground: "#111",
    red: "#f66",
  },
} as unknown as PluginTheme;
it("connects with a pasted Android endpoint in the single field", () => {
  const connect = vi.fn();
  render(
    <EndpointForm
      theme={theme}
      history={[]}
      pending={false}
      onConnect={connect}
      onRemove={() => {}}
    />,
  );
  const input = screen.getByLabelText("IP:port");
  fireEvent.change(input, { target: { value: " 192.168.1.80:37123 " } });
  fireEvent.click(screen.getByRole("button", { name: "Connect" }));
  expect(connect).toHaveBeenCalledWith("192.168.1.80:37123");
});
it("replaces a prior endpoint with the saved IP and colon and focuses the port position", async () => {
  render(
    <EndpointForm
      theme={theme}
      history={["192.168.1.80"]}
      pending={false}
      onConnect={() => {}}
      onRemove={() => {}}
    />,
  );
  const input = screen.getByLabelText("IP:port") as HTMLInputElement;
  fireEvent.change(input, { target: { value: "192.168.1.2:12345" } });
  fireEvent.click(screen.getByRole("button", { name: "Use 192.168.1.80" }));
  expect(input.value).toBe("192.168.1.80:");
  expect(document.activeElement).toBe(input);
  expect(input.selectionStart).toBe(13);
  expect(input.selectionEnd).toBe(13);
});
it("requires a fresh port before connecting a saved IP", () => {
  const connect = vi.fn();
  render(
    <EndpointForm
      theme={theme}
      history={["192.168.1.80"]}
      pending={false}
      onConnect={connect}
      onRemove={() => {}}
    />,
  );
  fireEvent.click(screen.getByRole("button", { name: "Use 192.168.1.80" }));
  fireEvent.click(screen.getByRole("button", { name: "Connect" }));
  expect(connect).not.toHaveBeenCalled();
  expect(screen.getByRole("alert").textContent).toMatch(/IP and port/);
});
