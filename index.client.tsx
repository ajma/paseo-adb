import type {
  PluginClientContext,
  PluginSidebarItemProps,
} from "@getpaseo/plugin/client";
import { SidebarRow } from "@getpaseo/plugin/client/ui";
import { AdbScreen } from "./client/screen";

function AdbItem({ currentScreen, openScreen }: PluginSidebarItemProps) {
  return (
    <SidebarRow
      icon="Smartphone"
      active={currentScreen?.screenId === "adb"}
      onPress={() => openScreen({ screenId: "adb" })}
    />
  );
}
export default function contribute(client: PluginClientContext) {
  client.addScreen({
    id: "adb",
    title: "Android Debug Bridge",
    Component: AdbScreen,
  });
  client.addSidebarHeaderItem({ id: "adb", title: "ADB", Component: AdbItem });
  client.addCommandCenterItem({
    id: "open-adb",
    title: "Manage Android devices",
    icon: "Smartphone",
    context: "global",
    onSelect: ({ openScreen }) => openScreen({ screenId: "adb" }),
  });
  return () => {};
}
