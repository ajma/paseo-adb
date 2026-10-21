import type { PluginScreenProps } from "@getpaseo/plugin/client";
import { useRpc } from "@getpaseo/plugin/client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ScrollView, Text, View } from "react-native";
import { useEffect, useRef } from "react";
import {
  devicesRpc,
  connectRpc,
  disconnectRpc,
  historyRpc,
  removeHistoryRpc,
  startPairingRpc,
  pairingStatusRpc,
  cancelPairingRpc,
} from "../shared/contracts";
import { EndpointForm } from "./endpoint-form";
import { DeviceCard } from "./device-card";
import { PairingCard } from "./pairing-card";
import { Action, Card, Feedback } from "./ui";

const keys = {
  devices: ["adb", "devices"],
  history: ["adb", "history"],
  pairing: ["adb", "pairing"],
};
const message = (error: unknown) =>
  error instanceof Error ? error.message : error ? String(error) : undefined;
export function AdbScreen({ theme, layout }: PluginScreenProps) {
  const queryClient = useQueryClient();
  const listDevices = useRpc(devicesRpc),
    listHistory = useRpc(historyRpc),
    getPairing = useRpc(pairingStatusRpc);
  const doConnect = useRpc(connectRpc),
    doDisconnect = useRpc(disconnectRpc),
    doRemove = useRpc(removeHistoryRpc);
  const doStart = useRpc(startPairingRpc),
    doCancel = useRpc(cancelPairingRpc);
  const devices = useQuery({
    queryKey: keys.devices,
    queryFn: () => listDevices({}),
    refetchInterval: 5000,
    retry: false,
  });
  const history = useQuery({
    queryKey: keys.history,
    queryFn: () => listHistory({}),
    refetchInterval: 5000,
    retry: false,
  });
  const pairing = useQuery({
    queryKey: keys.pairing,
    queryFn: () => getPairing({}),
    refetchInterval: 1000,
    retry: false,
  });
  const refresh = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: keys.devices }),
      queryClient.invalidateQueries({ queryKey: keys.history }),
    ]);
  };
  const connect = useMutation({
    mutationFn: (endpoint: string) => doConnect({ endpoint }),
    onSuccess: refresh,
  });
  const disconnect = useMutation({
    mutationFn: (serial: string) => doDisconnect({ serial }),
    onSuccess: refresh,
  });
  const remove = useMutation({
    mutationFn: (host: string) => doRemove({ host }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: keys.history }),
  });
  const start = useMutation({
    mutationFn: () => doStart({}),
    onSuccess: (state) => queryClient.setQueryData(keys.pairing, state),
  });
  const cancel = useMutation({
    mutationFn: (id: string) => doCancel({ id }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: keys.pairing }),
  });
  const previousPhase = useRef<string | undefined>(undefined);
  useEffect(() => {
    const phase = pairing.data?.phase;
    if (phase === "connected" && previousPhase.current !== "connected")
      void refresh();
    previousPhase.current = phase;
  }, [pairing.data?.phase]);
  const count =
    devices.data?.devices.filter((d) => d.state === "device").length ?? 0;
  return (
    <ScrollView
      keyboardShouldPersistTaps="handled"
      style={{ flex: 1, backgroundColor: theme.colors.surface0 }}
      contentContainerStyle={{ padding: layout.compact ? 16 : 28, gap: 22 }}
    >
      <View style={{ gap: 7 }}>
        <Text
          style={{
            color: theme.colors.foreground,
            fontSize: layout.compact ? 24 : 30,
            fontWeight: "700",
          }}
        >
          Android Debug Bridge
        </Text>
        <Text
          style={{
            color: theme.colors.foregroundMuted,
            fontSize: 14,
            lineHeight: 21,
          }}
        >
          Your Android devices, ready for development.
        </Text>
      </View>
      <View
        style={{
          flexDirection: layout.compact ? "column" : "row",
          alignItems: "stretch",
          gap: 18,
        }}
      >
        <View style={{ flex: 1, minWidth: 0 }}>
          <Card
            theme={theme}
            title="Connect a device"
            detail="Paste an address or reuse a recent IP with a new port."
          >
            <EndpointForm
              theme={theme}
              history={history.data ?? []}
              pending={connect.isPending}
              onConnect={(endpoint) => connect.mutate(endpoint)}
              onRemove={(host) => remove.mutate(host)}
            />
            <Feedback
              theme={theme}
              message={
                message(connect.error) ||
                message(remove.error) ||
                message(history.error)
              }
              error
            />
            {connect.isSuccess && (
              <Feedback
                theme={theme}
                message={[connect.data.message, connect.data.warning]
                  .filter(Boolean)
                  .join(" ")}
              />
            )}
          </Card>
        </View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <PairingCard
            theme={theme}
            state={pairing.data}
            pending={start.isPending || cancel.isPending}
            error={
              message(start.error) ||
              message(cancel.error) ||
              message(pairing.error)
            }
            onStart={() => start.mutate()}
            onCancel={() => {
              if (pairing.data) cancel.mutate(pairing.data.id);
            }}
          />
        </View>
      </View>
      <View style={{ gap: 13 }}>
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 12,
            flexWrap: "wrap",
          }}
        >
          <Text
            style={{
              color: theme.colors.foreground,
              fontSize: 19,
              fontWeight: "600",
            }}
          >
            Devices · {count} connected
          </Text>
          <Action
            theme={theme}
            secondary
            label={devices.isFetching ? "Refreshing…" : "Refresh"}
            disabled={devices.isFetching}
            onPress={() => {
              void refresh();
            }}
          />
        </View>
        <Feedback
          theme={theme}
          error
          message={message(devices.error) || message(disconnect.error)}
        />
        {devices.isPending && (
          <Feedback theme={theme} message="Looking for devices…" />
        )}
        {devices.data?.devices.length === 0 && (
          <Card
            theme={theme}
            title="No devices yet"
            detail="Pair using the QR code, connect with an IP:port, or attach a device over USB."
          >
            <Text
              style={{
                color: theme.colors.foregroundMuted,
                fontSize: 13,
                lineHeight: 20,
              }}
            >
              For USB devices, enable USB debugging and approve the
              authorization prompt on the phone.
            </Text>
          </Card>
        )}
        {devices.data?.devices.map((device) => (
          <DeviceCard
            key={device.serial}
            theme={theme}
            device={device}
            pending={
              disconnect.isPending && disconnect.variables === device.serial
            }
            onDisconnect={(serial) => disconnect.mutate(serial)}
          />
        ))}
        {devices.data && (
          <Text
            selectable
            style={{ color: theme.colors.foregroundMuted, fontSize: 11 }}
          >
            ADB on selected host: {devices.data.adbPath} · Refreshes every 5
            seconds
          </Text>
        )}
      </View>
    </ScrollView>
  );
}
