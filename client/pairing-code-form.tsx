import type { PluginTheme } from "@getpaseo/plugin";
import { useRpc } from "@getpaseo/plugin/client";
import { TextInput } from "@getpaseo/plugin/client/react-native";
import { useMutation } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { Text, View } from "react-native";
import { pairWithCodeRpc } from "../shared/contracts";
import {
  manualPairingInputSchema,
  type ManualPairingInput,
} from "../shared/manual-pairing";
import { Action, Feedback } from "./ui";

export function PairingCodeForm({
  theme,
  onPaired,
}: {
  theme: PluginTheme;
  onPaired: () => Promise<void>;
}) {
  const [host, setHost] = useState("");
  const [port, setPort] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState<string>();
  const submitting = useRef(false);
  const pairWithCode = useRpc(pairWithCodeRpc);
  const pair = useMutation({
    mutationFn: (input: ManualPairingInput) => pairWithCode(input),
    retry: false,
    onSuccess: async () => {
      setCode("");
      await onPaired();
    },
    onSettled: () => {
      submitting.current = false;
    },
  });
  const submit = () => {
    if (submitting.current) return;
    const result = manualPairingInputSchema.safeParse({
      host,
      port: /^\d+$/.test(port.trim()) ? Number(port) : 0,
      code,
    });
    if (!result.success) {
      setError(result.error.issues[0].message);
      return;
    }
    setError(undefined);
    submitting.current = true;
    pair.mutate(result.data);
  };
  const reset = () => {
    setError(undefined);
    pair.reset();
  };
  return (
    <View style={{ gap: 14 }}>
      <Text
        style={{
          color: theme.colors.foregroundMuted,
          fontSize: 13,
          lineHeight: 21,
        }}
      >
        On your device, open Wireless debugging → Pair device with pairing code.
        Enter the IP address, pairing port, and six-digit code shown there. Keep
        the device and Paseo host on the same network.
      </Text>
      {[
        {
          label: "IP address",
          accessibilityLabel: "Pairing IP address",
          value: host,
          change: setHost,
          placeholder: "192.168.1.80",
          numeric: false,
        },
        {
          label: "Pairing port",
          accessibilityLabel: "Pairing port",
          value: port,
          change: setPort,
          placeholder: "37123",
          numeric: true,
        },
        {
          label: "Pairing code",
          accessibilityLabel: "Pairing code",
          value: code,
          change: setCode,
          placeholder: "123456",
          numeric: true,
        },
      ].map((field) => (
        <View key={field.label} style={{ gap: 7 }}>
          <Text
            style={{
              color: theme.colors.foreground,
              fontSize: 13,
              fontWeight: "600",
            }}
          >
            {field.label}
          </Text>
          <TextInput
            accessibilityLabel={field.accessibilityLabel}
            value={field.value}
            onChangeText={(value) => {
              field.change(value);
              reset();
            }}
            placeholder={field.placeholder}
            placeholderTextColor={theme.colors.foregroundMuted}
            keyboardType={field.numeric ? "number-pad" : "default"}
            autoCapitalize="none"
            autoCorrect={false}
            autoComplete="off"
            spellCheck={false}
            maxLength={
              field.label === "Pairing code" ? 6 : field.numeric ? 5 : 100
            }
            editable={!pair.isPending}
            returnKeyType="go"
            onSubmitEditing={submit}
            style={{
              color: theme.colors.foreground,
              backgroundColor: theme.colors.surface2,
              borderColor: theme.colors.border,
              borderWidth: 1,
              borderRadius: 9,
              paddingHorizontal: 14,
              paddingVertical: 13,
              fontSize: 16,
              minHeight: 48,
            }}
          />
        </View>
      ))}
      <Action
        theme={theme}
        icon="Link"
        label={pair.isPending ? "Pairing…" : "Pair"}
        disabled={pair.isPending || !host || !port || !code}
        onPress={submit}
      />
      <Feedback theme={theme} error message={error || pair.error?.message} />
      {pair.isSuccess && <Feedback theme={theme} message={pair.data.message} />}
      {pair.isSuccess && <Feedback theme={theme} message={pair.data.warning} />}
    </View>
  );
}
