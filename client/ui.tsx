import type { PluginTheme } from "@getpaseo/plugin";
import { Icon } from "@getpaseo/plugin/client/react-native";
import { Pressable, Text, View } from "react-native";
import type { ReactNode } from "react";

export function Action({
  theme,
  label,
  icon,
  onPress,
  disabled = false,
  secondary = false,
  accessibilityLabel,
}: {
  theme: PluginTheme;
  label: string;
  icon?: string;
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
        flexDirection: "row",
        alignItems: "center",
        gap: 8,
        justifyContent: "center",
      })}
    >
      {icon && (
        <Icon
          name={icon}
          size={18}
          color={
            secondary ? theme.colors.foreground : theme.colors.accentForeground
          }
        />
      )}
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
  icon,
  detail,
  headerAction,
  children,
}: {
  theme: PluginTheme;
  title: string;
  icon?: string;
  detail?: string;
  headerAction?: ReactNode;
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
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            flexWrap: "wrap",
            gap: 12,
          }}
        >
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 10,
              flex: 1,
              minWidth: 150,
            }}
          >
            {icon && <Icon name={icon} size={22} color={theme.colors.accent} />}
            <Text
              style={{
                color: theme.colors.foreground,
                fontSize: 18,
                fontWeight: "600",
                flexShrink: 1,
              }}
            >
              {title}
            </Text>
          </View>
          {headerAction && (
            <View style={{ marginLeft: "auto" }}>{headerAction}</View>
          )}
        </View>
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
