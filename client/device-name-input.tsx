import type { PluginTheme } from "@getpaseo/plugin";
import { useRpc } from "@getpaseo/plugin/client";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { Text, TextInput, View } from "react-native";
import { renameDeviceRpc, type Device } from "../shared/contracts";
import {
  MAX_DEVICE_NAME_LENGTH,
  originalDeviceName,
} from "../shared/device-name";
import { Action, Feedback } from "./ui";

export function DeviceNameInput({
  theme,
  device,
  onClose,
}: {
  theme: PluginTheme;
  device: Device;
  onClose: () => void;
}) {
  const [name, setName] = useState(device.customName ?? "");
  const saving = useRef(false);
  const rename = useRpc(renameDeviceRpc);
  const queryClient = useQueryClient();
  const save = useMutation({
    mutationFn: () => rename({ serial: device.serial, name: name.trim() }),
    retry: false,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["adb", "devices"] });
      await queryClient.invalidateQueries({ queryKey: ["adb", "history"] });
      onClose();
    },
    onSettled: () => {
      saving.current = false;
    },
  });
  const submit = () => {
    if (saving.current) return;
    saving.current = true;
    save.mutate();
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
        Rename device
      </Text>
      <Text
        style={{
          color: theme.colors.foregroundMuted,
          fontSize: 12,
          lineHeight: 18,
        }}
      >
        The original name ({originalDeviceName(device)}) stays in parentheses.
        Leave blank to restore it.
      </Text>
      <TextInput
        accessibilityLabel={`Name for ${device.serial}`}
        placeholder="Custom device name"
        placeholderTextColor={theme.colors.foregroundMuted}
        value={name}
        onChangeText={(value) => {
          setName(value);
          save.reset();
        }}
        autoFocus
        autoCorrect={false}
        maxLength={MAX_DEVICE_NAME_LENGTH}
        editable={!save.isPending}
        returnKeyType="done"
        onSubmitEditing={submit}
        onKeyPress={({ nativeEvent }) => {
          if (nativeEvent.key === "Escape" && !saving.current) onClose();
        }}
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
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
        <Action
          theme={theme}
          label={save.isPending ? "Saving…" : "Save name"}
          disabled={save.isPending}
          onPress={submit}
        />
        <Action
          theme={theme}
          label="Cancel"
          secondary
          disabled={save.isPending}
          onPress={onClose}
        />
      </View>
      <Feedback theme={theme} error message={save.error?.message} />
    </View>
  );
}
