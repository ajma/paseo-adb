import type { PluginTheme } from "@getpaseo/plugin";
import { useRpc } from "@getpaseo/plugin/client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { Pressable, ScrollView, Text, TextInput, View } from "react-native";
import {
  inputTextRpc,
  textHistoryRpc,
  removeTextHistoryRpc,
} from "../shared/contracts";
import { inputTextSchema, MAX_INPUT_TEXT_LENGTH } from "../shared/input-text";
import { Action, Feedback } from "./ui";

const historyKey = ["adb", "input", "history"];

export function DeviceTextInput({
  theme,
  serial,
  onClose,
}: {
  theme: PluginTheme;
  serial: string;
  onClose: () => void;
}) {
  const [text, setText] = useState("");
  const [error, setError] = useState<string>();
  const [historyOpen, setHistoryOpen] = useState(false);
  const input = useRef<TextInput>(null);
  const blurTimer = useRef<ReturnType<typeof setTimeout> | undefined>(
    undefined,
  );
  const cancelClose = () => {
    if (blurTimer.current !== undefined) clearTimeout(blurTimer.current);
  };
  const keepOpen = () => {
    cancelClose();
    setHistoryOpen(true);
  };
  const closeSoon = () => {
    cancelClose();
    // Let focus move to a suggestion or its remove button before closing.
    blurTimer.current = setTimeout(() => setHistoryOpen(false), 150);
  };
  useEffect(
    () => () => {
      if (blurTimer.current !== undefined) clearTimeout(blurTimer.current);
    },
    [],
  );
  const sending = useRef(false);
  const sendText = useRpc(inputTextRpc);
  const listHistory = useRpc(textHistoryRpc);
  const removeHistory = useRpc(removeTextHistoryRpc);
  const queryClient = useQueryClient();
  const history = useQuery({
    queryKey: historyKey,
    queryFn: () => listHistory({}),
    enabled: historyOpen,
    retry: false,
  });
  const remove = useMutation({
    mutationFn: (text: string) => removeHistory({ text }),
    retry: false,
    onSuccess: async (_, text) => {
      queryClient.setQueryData<string[]>(historyKey, (entries) =>
        entries?.filter((entry) => entry !== text),
      );
      await queryClient.invalidateQueries({ queryKey: historyKey });
    },
  });
  const send = useMutation({
    mutationFn: (value: string) => sendText({ serial, text: value }),
    // Retrying could type the same text twice after a transport failure.
    retry: false,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: historyKey }),
    onSettled: () => {
      sending.current = false;
    },
  });
  const submit = () => {
    if (sending.current) return;
    const result = inputTextSchema.safeParse(text);
    if (!result.success) {
      setError(result.error.issues[0].message);
      return;
    }
    setError(undefined);
    sending.current = true;
    send.mutate(result.data);
  };
  return (
    <View
      style={{
        padding: 14,
        gap: 12,
        borderTopWidth: 1,
        borderColor: theme.colors.border,
      }}
    >
      <Text
        style={{
          color: theme.colors.foreground,
          fontSize: 14,
          fontWeight: "600",
        }}
      >
        Send text to device
      </Text>
      <Text
        style={{
          color: theme.colors.foregroundMuted,
          fontSize: 12,
          lineHeight: 18,
        }}
      >
        Focus a text field on the device first. Supports English letters,
        numbers, spaces, and punctuation.
      </Text>
      <TextInput
        ref={input}
        accessibilityLabel={`Text to send to ${serial}`}
        placeholder="Type or paste text…"
        placeholderTextColor={theme.colors.foregroundMuted}
        value={text}
        onFocus={keepOpen}
        onBlur={closeSoon}
        onKeyPress={({ nativeEvent }) => {
          if (nativeEvent.key === "Escape") {
            cancelClose();
            setHistoryOpen(false);
          }
        }}
        onChangeText={(value) => {
          setText(value);
          setError(undefined);
          send.reset();
        }}
        autoCapitalize="none"
        autoCorrect={false}
        spellCheck={false}
        maxLength={MAX_INPUT_TEXT_LENGTH}
        editable={!send.isPending}
        returnKeyType="send"
        onSubmitEditing={submit}
        style={{
          color: theme.colors.foreground,
          backgroundColor: theme.colors.surface2,
          borderColor: error ? theme.colors.statusDanger : theme.colors.border,
          borderWidth: 1,
          borderRadius: 9,
          paddingHorizontal: 14,
          paddingVertical: 13,
          fontSize: 16,
          minHeight: 48,
        }}
      />
      {historyOpen && (
        <View
          style={{
            borderWidth: 1,
            borderColor: theme.colors.border,
            borderRadius: 9,
            overflow: "hidden",
            backgroundColor: theme.colors.surface2,
          }}
        >
          <Text
            style={{
              color: theme.colors.foregroundMuted,
              fontSize: 11,
              fontWeight: "600",
              padding: 10,
            }}
          >
            PREVIOUSLY SENT
          </Text>
          <ScrollView
            keyboardShouldPersistTaps="always"
            nestedScrollEnabled
            style={{ maxHeight: 220 }}
          >
            {history.data?.map((entry) => (
              <View
                key={entry}
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  borderTopWidth: 1,
                  borderColor: theme.colors.border,
                }}
              >
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`Use text: ${entry}`}
                  disabled={send.isPending}
                  onFocus={keepOpen}
                  onBlur={closeSoon}
                  onPressIn={cancelClose}
                  onPress={() => {
                    setText(entry);
                    setError(undefined);
                    send.reset();
                    keepOpen();
                    input.current?.focus();
                  }}
                  style={({ pressed }) => ({
                    flex: 1,
                    minWidth: 0,
                    padding: 12,
                    minHeight: 44,
                    justifyContent: "center",
                    opacity: pressed ? 0.7 : 1,
                  })}
                >
                  <Text
                    numberOfLines={1}
                    style={{ color: theme.colors.foreground, fontSize: 14 }}
                  >
                    {entry}
                  </Text>
                </Pressable>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`Remove text: ${entry}`}
                  disabled={remove.isPending || send.isPending}
                  onFocus={keepOpen}
                  onBlur={closeSoon}
                  onPressIn={cancelClose}
                  onPress={() => {
                    keepOpen();
                    input.current?.focus();
                    remove.mutate(entry);
                  }}
                  style={({ pressed }) => ({
                    minWidth: 44,
                    minHeight: 44,
                    alignItems: "center",
                    justifyContent: "center",
                    opacity: remove.isPending ? 0.45 : pressed ? 0.7 : 1,
                  })}
                >
                  <Text
                    style={{
                      color: theme.colors.foregroundMuted,
                      fontSize: 22,
                    }}
                  >
                    ×
                  </Text>
                </Pressable>
              </View>
            ))}
          </ScrollView>
          {history.isPending && (
            <View style={{ padding: 10 }}>
              <Feedback theme={theme} message="Loading text history…" />
            </View>
          )}
          {history.data?.length === 0 && (
            <View style={{ padding: 10 }}>
              <Feedback theme={theme} message="No sent text yet." />
            </View>
          )}
          {(history.error || remove.error) && (
            <View style={{ padding: 10 }}>
              <Feedback
                theme={theme}
                error
                message={history.error?.message || remove.error?.message}
              />
            </View>
          )}
        </View>
      )}
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
        <Action
          theme={theme}
          label={send.isPending ? "Sending…" : "Send text"}
          disabled={send.isPending || text.length === 0}
          onPress={submit}
        />
        <Action
          theme={theme}
          label="Close"
          secondary
          disabled={send.isPending}
          onPress={onClose}
        />
      </View>
      <Feedback theme={theme} error message={error || send.error?.message} />
      {send.isSuccess && <Feedback theme={theme} message={send.data.message} />}
      {send.isSuccess && <Feedback theme={theme} message={send.data.warning} />}
    </View>
  );
}
