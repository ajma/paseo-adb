import type { PluginTheme } from "@getpaseo/plugin";
import { useEffect, useRef, useState } from "react";
import { Pressable, Text, TextInput, View } from "react-native";
import {
  historyPrefix,
  parseEndpoint,
  type IpHistoryEntry,
} from "../shared/endpoint";
import { Action, Feedback } from "./ui";

export function EndpointForm({
  theme,
  history,
  pending,
  onConnect,
  onRemove,
}: {
  theme: PluginTheme;
  history: IpHistoryEntry[];
  pending: boolean;
  onConnect: (endpoint: string) => void;
  onRemove: (host: string) => void;
}) {
  const [value, setValue] = useState("");
  const [error, setError] = useState<string>();
  const [selection, setSelection] = useState<{ start: number; end: number }>();
  const input = useRef<TextInput>(null);
  const shouldFocus = useRef(false);
  useEffect(() => {
    if (shouldFocus.current) {
      input.current?.focus();
      shouldFocus.current = false;
    }
  }, [value, selection]);
  const selectHistory = (host: string) => {
    const prefix = historyPrefix(host);
    shouldFocus.current = true;
    setValue(prefix);
    setSelection({ start: prefix.length, end: prefix.length });
    setError(undefined);
  };
  const submit = () => {
    if (pending) return;
    try {
      const endpoint = parseEndpoint(value);
      setError(undefined);
      onConnect(endpoint.address);
    } catch (error) {
      setError((error as Error).message);
    }
  };
  return (
    <View style={{ gap: 14 }}>
      <Text
        style={{
          color: theme.colors.foreground,
          fontSize: 13,
          fontWeight: "600",
        }}
      >
        IP:port
      </Text>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
        <TextInput
          ref={input}
          accessibilityLabel="IP:port"
          value={value}
          selection={selection}
          onSelectionChange={({ nativeEvent }) =>
            setSelection((current) =>
              current ? nativeEvent.selection : undefined,
            )
          }
          placeholder="192.168.1.80:37123"
          placeholderTextColor={theme.colors.foregroundMuted}
          autoCapitalize="none"
          autoCorrect={false}
          spellCheck={false}
          returnKeyType="go"
          editable={!pending}
          onSubmitEditing={submit}
          onChangeText={(text) => {
            setValue(text);
            setSelection(undefined);
            setError(undefined);
          }}
          style={{
            flex: 1,
            minWidth: 0,
            color: theme.colors.foreground,
            backgroundColor: theme.colors.surface2,
            borderColor: error
              ? theme.colors.statusDanger
              : theme.colors.border,
            borderWidth: 1,
            borderRadius: 9,
            paddingHorizontal: 14,
            paddingVertical: 13,
            fontSize: 16,
            minHeight: 48,
          }}
        />
        <View>
          <Action
            theme={theme}
            label={pending ? "Connecting…" : "Connect"}
            disabled={pending}
            onPress={submit}
          />
        </View>
      </View>
      <Feedback theme={theme} message={error} error />
      <Text
        style={{
          color: theme.colors.foregroundMuted,
          fontSize: 12,
          lineHeight: 18,
        }}
      >
        Paste the address from the main Wireless debugging screen. The pairing
        dialog uses a different port.
      </Text>
      <View style={{ gap: 9, paddingTop: 6 }}>
        <Text
          style={{
            color: theme.colors.foregroundMuted,
            fontSize: 11,
            fontWeight: "700",
            letterSpacing: 1,
          }}
        >
          RECENT IPs · LAST 5
        </Text>
        {history.length === 0 && (
          <Text style={{ color: theme.colors.foregroundMuted, fontSize: 13 }}>
            Successful connections will appear here.
          </Text>
        )}
        {history.map(({ host, description }) => (
          <View
            key={host}
            style={{ flexDirection: "row", alignItems: "center", gap: 8 }}
          >
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Use ${host}`}
              disabled={pending}
              onPress={() => selectHistory(host)}
              style={({ pressed }) => ({
                flex: 1,
                paddingHorizontal: 12,
                paddingVertical: 12,
                borderRadius: 8,
                backgroundColor: theme.colors.surface2,
                opacity: pressed ? 0.7 : 1,
                flexDirection: "row",
                alignItems: "center",
                flexWrap: "wrap",
                columnGap: 12,
                rowGap: 4,
              })}
            >
              <Text style={{ color: theme.colors.foreground, fontSize: 14 }}>
                {host}
              </Text>
              <Text
                style={{
                  color: theme.colors.foregroundMuted,
                  fontSize: 13,
                  flexShrink: 1,
                }}
              >
                {description ?? "Device details unavailable"}
              </Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Remove ${host} from history`}
              disabled={pending}
              onPress={() => onRemove(host)}
              style={{
                minWidth: 44,
                minHeight: 44,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Text
                style={{ color: theme.colors.foregroundMuted, fontSize: 22 }}
              >
                ×
              </Text>
            </Pressable>
          </View>
        ))}
        {history.length > 0 && (
          <Text style={{ color: theme.colors.foregroundMuted, fontSize: 12 }}>
            Choose an IP, then type its current port.
          </Text>
        )}
      </View>
    </View>
  );
}
