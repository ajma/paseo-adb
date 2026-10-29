import { vi } from "vitest";

// Paseo owns dialog presentation and icons. Exercise the plugin's controlled
// open state and dismiss callback through a minimal host UI stand-in.
vi.mock("@getpaseo/plugin/client/react-native", async () => {
  const { createElement } = await import("react");
  const { View, Text, Pressable, TextInput } = await import("react-native");
  const Modal = Object.assign(
    ({
      open,
      title,
      onOpenChange,
      children,
    }: {
      open: boolean;
      title: string;
      onOpenChange: (open: boolean) => void;
      children: import("react").ReactNode;
    }) =>
      open
        ? createElement(
            View,
            { accessibilityRole: "dialog", accessibilityLabel: title },
            createElement(Text, null, title),
            createElement(
              Pressable,
              {
                accessibilityRole: "button",
                accessibilityLabel: "Close pairing dialog",
                onPress: () => onOpenChange(false),
              },
              createElement(Text, null, "Close"),
            ),
            children,
          )
        : null,
    {
      Content: ({ children }: { children: import("react").ReactNode }) =>
        createElement(View, null, children),
    },
  );
  return { Icon: () => null, Modal, TextInput };
});
