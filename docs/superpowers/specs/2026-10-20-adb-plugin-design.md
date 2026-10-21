# Paseo ADB plugin design

## Intent

Manage Android Debug Bridge from a native Paseo screen: pair a device by scanning a QR code, see currently connected devices and their identifying information, and connect by pasting the address from Android's Wireless debugging screen.

The user specifically requires a single IP:port input and a history of the last five IPs. Selecting a saved IP must populate the input with the IP followed by a colon, ready for a new port.

## Screen and interaction

Register an ADB sidebar screen and a Command Center action that opens it. The screen uses React Native components, Paseo theme colors, and a compact layout that stacks its sections on narrow screens. All operations target the daemon selected in Paseo's screen host picker.

### Connect and history

- Provide one text field labeled `IP:port`, a Connect button, and a paste-friendly placeholder such as `192.168.1.80:37123`.
- Accept a pasted IPv4 address and port, trim surrounding whitespace, and validate the address and port before running ADB. Support bracketed IPv6 endpoints as well.
- Require an explicit port in the range 1–65535; do not assume a fixed port. The field refers to the connection address on Android's main Wireless debugging screen.
- Keep the five most recent distinct IPs from successful manual or QR connections, ordered by most recent use. Reusing an IP moves it to the top without making a duplicate. A sixth distinct IP removes the oldest entry.
- Persist history on the selected daemon so it survives plugin and daemon restarts and is shared by clients using that daemon. History belongs to the host rather than an individual workspace.
- Clicking a history entry replaces the field with `192.168.1.80:` (or `[IPv6]:`), focuses the input, and puts the cursor at its end. It does not connect until the user supplies a port and submits.
- Persist IPs, not ports. Each entry has a Remove action.
- Show connection progress and the result. Preserve the entered endpoint after an error so it can be corrected.

### QR pairing

- A Pair with QR code action creates a fresh session and displays a scannable QR code with instructions to open Developer options → Wireless debugging → Pair device with QR code on Android.
- Generate the Android Studio-compatible payload with a random `studio-` service name and random pairing password. Render the QR locally without an external image service.
- Discover the matching `_adb-tls-pairing._tcp` instance through `adb mdns services`, pair using the generated password, then find the device's connection service on the same IP and connect when necessary.
- Keep pairing and connection ports distinct. A successful pairing with an unsuccessful connection is reported as paired, with a prompt to paste the current connection address.
- Expose waiting, pairing, connecting, connected, failed, expired, and canceled states. Sessions expire after two minutes; Cancel and Generate new code stop the old session. Old polling and pairing tasks must not update a replacement session.
- Hold the QR password only in session memory and do not include it in history or logs. Stop polling and owned child processes during plugin cleanup.
- If mDNS is unavailable or no matching service is found, show actionable feedback while leaving manual connection available.

### Devices

- List every transport returned by `adb devices -l`, including USB, Wi-Fi, emulators, offline devices, and unauthorized devices. Refresh every five seconds while the screen is open, with a manual Refresh action and refresh after connection changes.
- Show manufacturer, model, Android version, serial or transport address, and status when available. Read properties only for online, authorized devices; property failures must not hide a device or fail the entire list.
- Prefer manufacturer and model as the readable title, falling back to the model from `devices -l`, then the serial/address. Missing details appear as unavailable.
- Show useful empty, loading, and ADB unavailable states. Explain unauthorized status with an instruction to approve the device's debugging prompt.
- Provide Disconnect for network transports. Do not offer an ineffective network disconnect operation for USB devices.

## Implementation boundaries

- `index.client.tsx` registers the screen, sidebar item, and Command Center action.
- `client/` owns the screen, device rows, endpoint form, history controls, QR rendering, and query/mutation state.
- `shared/` owns validated RPC contracts and plain shared endpoint values.
- `index.server.ts` registers handlers and disposes owned resources.
- `server/` owns ADB process execution, output parsing, device properties, pairing session orchestration, and serialized history persistence.

Use the installed ADB executable on the daemon machine, including standard Android SDK locations when the daemon PATH omits platform-tools. Execute it with argument arrays rather than shell interpolation, bounded command timeouts, and bounded output. Treat ADB's textual failure responses as failures even when its process exits successfully.

Use the current Paseo plugin SDK and manifest compatibility range. TanStack Query owns client request state. Plugin RPCs cover ADB-specific work; no extra Paseo connection is created.

## Validation

Verify endpoint parsing, port validation, ADB device and mDNS parsing, textual command failures, history ordering/deduplication/eviction/persistence, and QR session success, expiry, cancellation, and replacement with controlled command responses.

Verify the history interaction fills exactly `IP:` with no previous port, focuses the single field, and positions the cursor for a new port. Verify the field accepts a pasted complete endpoint.

Run TypeScript checks, relevant automated tests, and Paseo's plugin compilation/loading checks. Audit client code for browser-only APIs and inspect the compact layout. Exercise live device discovery on the host when accessible; a physical phone scan remains necessary to prove real QR pairing and must be reported as unverified if no device is available.

## Sources

- [Paseo plugin reference](https://paseo.sh/docs/plugins/reference)
- [Android ADB Wi-Fi architecture and QR pairing](https://android.googlesource.com/platform/packages/modules/adb/+/HEAD/docs/dev/adb_wifi.md)
