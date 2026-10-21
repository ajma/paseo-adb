import type { PluginTheme } from "@getpaseo/plugin";
import { Text, View } from "react-native";
import type { Device } from "../shared/contracts";
import { Action } from "./ui";
export function DeviceCard({
  theme,
  device,
  pending,
  onDisconnect,
}: {
  theme: PluginTheme;
  device: Device;
  pending: boolean;
  onDisconnect: (serial: string) => void;
}) {
  const { manufacturer, model, serial, state } = device;
  const title = [manufacturer, model].filter(Boolean).join(" ") || serial;
  const online = state === "device";
  return (
    <View
      style={{
        gap: 10,
        padding: 16,
        borderRadius: 10,
        borderWidth: 1,
        borderColor: theme.colors.border,
        backgroundColor: theme.colors.surface1,
      }}
    >
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
          flexWrap: "wrap",
        }}
      >
        <Text
          style={{
            color: theme.colors.foreground,
            fontSize: 16,
            fontWeight: "600",
            flexShrink: 1,
          }}
        >
          {title}
        </Text>
        <Text
          style={{
            color: online
              ? theme.colors.statusSuccess
              : theme.colors.statusWarning,
            fontSize: 12,
            fontWeight: "600",
          }}
        >
          {online ? "Connected" : state}
        </Text>
      </View>
      {title !== serial && (
        <Text
          selectable
          style={{ color: theme.colors.foregroundMuted, fontSize: 12 }}
        >
          {serial}
        </Text>
      )}
      <View style={{ flexDirection: "row", gap: 12, flexWrap: "wrap" }}>
        <Text style={{ color: theme.colors.foregroundMuted, fontSize: 12 }}>
          {device.network
            ? "Wi-Fi / network"
            : serial.startsWith("emulator-")
              ? "Emulator"
              : "USB"}
        </Text>
        <Text style={{ color: theme.colors.foregroundMuted, fontSize: 12 }}>
          {device.androidVersion
            ? `Android ${device.androidVersion}`
            : "Android version unavailable"}
        </Text>
      </View>
      {state === "unauthorized" && (
        <Text
          style={{
            color: theme.colors.foregroundMuted,
            fontSize: 13,
            lineHeight: 20,
          }}
        >
          Approve the debugging prompt on the device to see its details.
        </Text>
      )}
      {state === "offline" && (
        <Text
          style={{
            color: theme.colors.foregroundMuted,
            fontSize: 13,
            lineHeight: 20,
          }}
        >
          Device is offline. Check its connection and Wireless debugging
          setting.
        </Text>
      )}
      {device.network && (
        <Action
          theme={theme}
          secondary
          label={pending ? "Disconnecting…" : "Disconnect"}
          accessibilityLabel={`Disconnect ${serial}`}
          disabled={pending}
          onPress={() => onDisconnect(serial)}
        />
      )}
    </View>
  );
}
