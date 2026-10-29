import type { PluginTheme } from "@getpaseo/plugin";
import { Icon } from "@getpaseo/plugin/client/react-native";
import { Text, View } from "react-native";
import { useState } from "react";
import type { Device } from "../shared/contracts";
import { Action } from "./ui";
import { deviceTypeIcons } from "../shared/device-type";
import { DeviceTextInput } from "./device-text-input";
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
  const [inputOpen, setInputOpen] = useState(false);
  return (
    <View
      style={{
        borderRadius: 10,
        overflow: "hidden",
        borderWidth: 1,
        borderColor: theme.colors.border,
        backgroundColor: theme.colors.surface1,
      }}
    >
      <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
        <View
          style={{
            width: 48,
            flexShrink: 0,
            alignSelf: "stretch",
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: theme.colors.surface2,
          }}
        >
          <Icon
            name={
              deviceTypeIcons[
                device.deviceType ??
                  (serial.startsWith("emulator-") ? "emulator" : "unknown")
              ]
            }
            size={32}
            color={theme.colors.accent}
          />
        </View>
        <View
          style={{
            flex: 1,
            minWidth: 0,
            gap: 4,
            paddingVertical: 10,
            paddingRight: 12,
          }}
        >
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 8,
              flexWrap: "wrap",
            }}
          >
            <Text
              style={{
                color: theme.colors.foreground,
                fontSize: 14,
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
                fontSize: 11,
                fontWeight: "600",
              }}
            >
              {online ? "Connected" : state}
            </Text>
          </View>
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 8,
              flexWrap: "wrap",
            }}
          >
            {title !== serial && (
              <Text
                selectable
                numberOfLines={1}
                style={{
                  color: theme.colors.foregroundMuted,
                  fontSize: 11,
                  flexShrink: 1,
                }}
              >
                {serial}
              </Text>
            )}
            <Text style={{ color: theme.colors.foregroundMuted, fontSize: 11 }}>
              {device.network
                ? "Wi-Fi / network"
                : serial.startsWith("emulator-")
                  ? "Emulator"
                  : "USB"}
            </Text>
            <Text style={{ color: theme.colors.foregroundMuted, fontSize: 11 }}>
              {device.androidVersion
                ? `Android ${device.androidVersion}`
                : "Android version unavailable"}
            </Text>
          </View>
          {state === "unauthorized" && (
            <Text
              style={{
                color: theme.colors.foregroundMuted,
                fontSize: 12,
                lineHeight: 18,
              }}
            >
              Approve the debugging prompt on the device to see its details.
            </Text>
          )}
          {state === "offline" && (
            <Text
              style={{
                color: theme.colors.foregroundMuted,
                fontSize: 12,
                lineHeight: 18,
              }}
            >
              Device is offline. Check its connection and Wireless debugging
              setting.
            </Text>
          )}
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
            {online && !inputOpen && (
              <Action
                theme={theme}
                secondary
                label="Send text"
                accessibilityLabel={`Send text to ${serial}`}
                disabled={pending}
                onPress={() => setInputOpen(true)}
              />
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
        </View>
      </View>
      {online && inputOpen && (
        <DeviceTextInput
          theme={theme}
          serial={serial}
          onClose={() => setInputOpen(false)}
        />
      )}
    </View>
  );
}
