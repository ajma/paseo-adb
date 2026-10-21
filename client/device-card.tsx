import type { PluginTheme } from "@getpaseo/plugin";
import { Icon } from "@getpaseo/plugin/client/react-native";
import { Text, View } from "react-native";
import type { Device } from "../shared/contracts";
import { Action } from "./ui";
import { deviceTypeIcons } from "../shared/device-type";
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
        flexDirection: "row",
        alignItems: "center",
        gap: 12,
        borderRadius: 10,
        overflow: "hidden",
        borderWidth: 1,
        borderColor: theme.colors.border,
        backgroundColor: theme.colors.surface1,
      }}
    >
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
          paddingRight: device.network ? 0 : 12,
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
      </View>
      {device.network && (
        <View style={{ marginRight: 12 }}>
          <Action
            theme={theme}
            secondary
            label={pending ? "Disconnecting…" : "Disconnect"}
            accessibilityLabel={`Disconnect ${serial}`}
            disabled={pending}
            onPress={() => onDisconnect(serial)}
          />
        </View>
      )}
    </View>
  );
}
