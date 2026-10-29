import type { PluginTheme } from "@getpaseo/plugin";
import { Icon, Modal } from "@getpaseo/plugin/client/react-native";
import { useState } from "react";
import { Image, Pressable, Text, View } from "react-native";
import type { PairingState } from "../shared/contracts";
import { Action, Feedback } from "./ui";
import { PairingCodeForm } from "./pairing-code-form";

export function PairingDialog({
  theme,
  open,
  onOpenChange,
  state,
  pending,
  error,
  onStart,
  onCancel,
  onPaired,
}: {
  theme: PluginTheme;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  state: PairingState | null | undefined;
  pending: boolean;
  error?: string;
  onStart: () => void;
  onCancel: () => void;
  onPaired: () => Promise<void>;
}) {
  const [method, setMethod] = useState<"qr" | "code">("qr");
  const active =
    state && ["waiting", "pairing", "connecting"].includes(state.phase);
  return (
    <Modal
      title="Pair"
      icon={<Icon name="Link" size={20} color={theme.colors.accent} />}
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) setMethod("qr");
        onOpenChange(nextOpen);
      }}
    >
      <Modal.Content contentContainerStyle={{ gap: 14, padding: 20 }}>
        <View style={{ flexDirection: "row", gap: 8 }}>
          {(
            [
              { id: "qr", label: "QR code", icon: "QrCode" },
              { id: "code", label: "Pairing code", icon: "KeyRound" },
            ] as const
          ).map((tab) => (
            <Pressable
              key={tab.id}
              accessibilityRole="tab"
              accessibilityState={{ selected: method === tab.id }}
              onPress={() => setMethod(tab.id)}
              style={{
                flex: 1,
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "center",
                gap: 8,
                minHeight: 44,
                padding: 10,
                borderRadius: 9,
                backgroundColor:
                  method === tab.id
                    ? theme.colors.accent
                    : theme.colors.surface2,
              }}
            >
              <Icon
                name={tab.icon}
                size={18}
                color={
                  method === tab.id
                    ? theme.colors.accentForeground
                    : theme.colors.foreground
                }
              />
              <Text
                style={{
                  color:
                    method === tab.id
                      ? theme.colors.accentForeground
                      : theme.colors.foreground,
                  fontSize: 14,
                  fontWeight: "600",
                }}
              >
                {tab.label}
              </Text>
            </Pressable>
          ))}
        </View>
        {open && method === "code" && (
          <PairingCodeForm theme={theme} onPaired={onPaired} />
        )}
        {method === "qr" && (
          <>
            <Text
              style={{
                color: theme.colors.foregroundMuted,
                fontSize: 13,
                lineHeight: 21,
              }}
            >
              On your phone, open Developer options → Wireless debugging → Pair
              device with QR code. Keep the phone and the Paseo host on the same
              network.
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
              <Text
                style={{ color: theme.colors.foregroundMuted, fontSize: 12 }}
              >
                This code expires after 2 minutes.
              </Text>
            )}
          </>
        )}
      </Modal.Content>
    </Modal>
  );
}
