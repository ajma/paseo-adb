# Paseo ADB

Manage Android Debug Bridge from Paseo's **ADB** sidebar screen.

- Pair a phone with a locally generated QR code.
- See USB, wireless, and emulator transports, including offline and unauthorized devices.
- See manufacturer, model, Android version, and serial/address when the device allows it.
- Paste the complete `IP:port` from Android's Wireless debugging screen.
- Reuse the last **five distinct successful IPs**. Clicking an IP fills `IP:`, focuses the field, and puts the cursor after the colon. Enter the current port and connect.
- Disconnect network devices and remove individual history entries.

## Install

Requires Paseo **0.12.0 or later** on the daemon and client, Node/npm for development, and Android SDK Platform-Tools on the daemon machine.

```sh
npm install
npm run typecheck
npm test
paseo plugin install /absolute/path/to/paseo-adb
```

Enable plugins in Settings → Plugins if needed. Paseo plugins are trusted code running with the daemon user's access.

Open **ADB** in the sidebar, or search **Manage Android devices** in the Command Center. Paseo's host picker selects which machine's ADB, devices, pairing session, and history you use.

## Pair with a QR code

1. Connect the phone and the selected Paseo daemon machine to the same network.
2. Enable Developer options and Wireless debugging on the phone.
3. In Paseo, choose **Generate QR code**.
4. On the phone, open **Wireless debugging → Pair device with QR code** and scan the displayed code.
5. The plugin discovers the phone, pairs it, and connects using its advertised connection port.

The code expires after two minutes. **Cancel pairing** and **Generate new code** invalidate the current plugin session. A session already in progress is shared with other Paseo clients viewing this daemon.

If pairing succeeds but the connection port cannot be discovered, the screen reports **Paired**. Paste the main Wireless debugging screen's address into the manual field to connect.

## Connect by address

Copy the address from the phone's **main Wireless debugging screen**, paste it into the single **IP:port** field, then choose **Connect** or press Return.

Example: `192.168.1.80:37123`. IPv6 uses brackets: `[2001:db8::1]:37123`.

The pairing-code dialog's port is different from the connection port. Manual connection assumes the phone already trusts the host, or that the device supports an existing ADB TCP connection. Use QR pairing first for a new wireless-debugging host.

History contains only IPs from successful connections, ordered by most recent use, capped at five. Ports are intentionally not stored because Android can change them. QR credentials are never written to history.

## Device list

The list refreshes every five seconds while open. **Refresh** triggers an immediate refresh.

Offline and unauthorized devices remain visible. Metadata requires an online, authorized connection. Approve the debugging prompt on a USB-connected phone to make details available. **Disconnect** is available for network transports; unplug USB devices to disconnect them.

## ADB discovery and data

ADB runs on the selected daemon, even when you view Paseo on another computer or phone. Discovery checks `ADB_PATH`, `ANDROID_HOME`, `ANDROID_SDK_ROOT`, common SDK locations, then `PATH`. Set `ADB_PATH` to an executable file path if needed, then reload the plugin.

Recent IPs are saved on that host at:

```text
<PASEO_HOME or ~/.paseo>/plugin-data/adb/history.json
```

Writes are serialized and atomic, and the file is private to the daemon user. Removing a saved IP does not revoke the phone's ADB pairing. Revoke trust from Android's Wireless debugging settings.

## Troubleshooting

- **No ADB:** Install Android SDK Platform-Tools on the daemon host. Configure `ADB_PATH` or an Android SDK environment variable and reload the plugin.
- **QR scan waits or expires:** Use the scanner inside Wireless debugging. Check that phone and daemon are on the same local network and that mDNS/UDP 5353 is allowed. Guest Wi-Fi, access-point isolation, or VPNs can prevent discovery.
- **Paired but not connected:** Paste the current connection address from the main Wireless debugging screen.
- **Connection refused:** Recopy the address; the port may have changed after toggling wireless debugging.
- **History cannot be read:** The plugin preserves invalid history rather than replacing it. Back up and repair the JSON array of IP strings, or remove the corrupt file manually to start fresh.
- **Plugin failed:** Run `paseo plugin logs adb`.

## Development

```sh
npm test
npm run typecheck
npm pack --dry-run
paseo plugin reload adb
paseo plugin logs adb
```

The test suite covers endpoint validation, history persistence and eviction, ADB output and metadata, QR lifecycle races, and the actual React Native Web form interactions.

Reference: [Paseo plugin API](https://paseo.sh/docs/plugins/reference) · [Android ADB Wi-Fi architecture](https://android.googlesource.com/platform/packages/modules/adb/+/HEAD/docs/dev/adb_wifi.md).
