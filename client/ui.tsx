import type { PluginTheme } from "@getpaseo/plugin";
import { Pressable, Text, View } from "react-native";
import type { ReactNode } from "react";

export function Action({
  theme,
  label,
  onPress,
  disabled = false,
  secondary = false,
  accessibilityLabel,
}: {
  theme: PluginTheme;
  label: string;
  onPress: () => void;
  disabled?: boolean;
  secondary?: boolean;
  accessibilityLabel?: string;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => ({
        paddingHorizontal: 16,
        paddingVertical: 11,
        borderRadius: 9,
        backgroundColor: secondary
          ? theme.colors.surface2
          : theme.colors.accent,
        opacity: disabled ? 0.45 : pressed ? 0.75 : 1,
        alignSelf: "flex-start",
        minHeight: 44,
        justifyContent: "center",
      })}
    >
      <Text
        style={{
          color: secondary
            ? theme.colors.foreground
            : theme.colors.accentForeground,
          fontWeight: "600",
          fontSize: 14,
        }}
      >
        {label}
      </Text>
    </Pressable>
  );
}
export function Card({
  theme,
  title,
  detail,
  children,
}: {
  theme: PluginTheme;
  title: string;
  detail?: string;
  children: ReactNode;
}) {
  return (
    <View
      style={{
        gap: 14,
        padding: 20,
        borderRadius: 14,
        borderWidth: 1,
        borderColor: theme.colors.border,
        backgroundColor: theme.colors.surface1,
      }}
    >
      <View style={{ gap: 5 }}>
        <Text
          style={{
            color: theme.colors.foreground,
            fontSize: 18,
            fontWeight: "600",
          }}
        >
          {title}
        </Text>
        {detail && (
          <Text
            style={{
              color: theme.colors.foregroundMuted,
              fontSize: 13,
              lineHeight: 20,
            }}
          >
            {detail}
          </Text>
        )}
      </View>
      {children}
    </View>
  );
}
export function Feedback({
  theme,
  message,
  error = false,
}: {
  theme: PluginTheme;
  message?: string;
  error?: boolean;
}) {
  if (!message) return null;
  return (
    <Text
      accessibilityRole={error ? "alert" : undefined}
      selectable
      style={{
        color: error ? theme.colors.statusDanger : theme.colors.foregroundMuted,
        fontSize: 13,
        lineHeight: 20,
      }}
    >
      {message}
    </Text>
  );
}
