import type { PluginTheme } from "@getpaseo/plugin";
import { Image, Text, View } from "react-native";
import type { PairingState } from "../shared/contracts";
import { Action, Card, Feedback } from "./ui";

export function PairingCard({
  theme,
  state,
  pending,
  error,
  onStart,
  onCancel,
}: {
  theme: PluginTheme;
  state: PairingState | null | undefined;
  pending: boolean;
  error?: string;
  onStart: () => void;
  onCancel: () => void;
}) {
  const active =
    state && ["waiting", "pairing", "connecting"].includes(state.phase);
  return (
    <Card
      theme={theme}
      title="Pair with QR code"
      detail="Add a device over Wi-Fi without a USB cable."
    >
      <Text
        style={{
          color: theme.colors.foregroundMuted,
          fontSize: 13,
          lineHeight: 21,
        }}
      >
        On your phone, open Developer options → Wireless debugging → Pair device
        with QR code. Keep the phone and the Paseo host on the same network.
      </Text>
      {active && state.qr && (
        <Image
          source={{ uri: state.qr }}
          accessibilityLabel="Android wireless debugging pairing QR code"
          style={{
            width: 240,
            height: 240,
            maxWidth: "100%",
            alignSelf: "center",
          }}
          resizeMode="contain"
        />
      )}
      {state && (
        <Feedback
          theme={theme}
          message={state.message}
          error={state.phase === "failed" || state.phase === "expired"}
        />
      )}
      <Feedback theme={theme} message={error} error />
      <View style={{ flexDirection: "row", gap: 10, flexWrap: "wrap" }}>
        <Action
          theme={theme}
          label={
            pending
              ? "Working…"
              : state
                ? "Generate new code"
                : "Generate QR code"
          }
          disabled={pending}
          onPress={onStart}
        />
        {active && (
          <Action
            theme={theme}
            secondary
            label="Cancel pairing"
            disabled={pending}
            onPress={onCancel}
          />
        )}
      </View>
      {active && (
        <Text style={{ color: theme.colors.foregroundMuted, fontSize: 12 }}>
          This code expires after 2 minutes.
        </Text>
      )}
    </Card>
  );
}
