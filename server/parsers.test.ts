import { it, expect } from "vitest";
import { parseDevices, parseServices } from "./parsers";
it("keeps all device states and available metadata", () => {
  expect(
    parseDevices(
      "List of devices attached\nABC device usb:1-2 product:oriole model:Pixel_6 device:oriole transport_id:1\n192.168.1.3:40000 offline transport_id:2\nemulator-5554 unauthorized\n",
    ),
  ).toEqual([
    {
      serial: "ABC",
      state: "device",
      model: "Pixel 6",
      product: "oriole",
      transportId: "1",
      network: false,
    },
    {
      serial: "192.168.1.3:40000",
      state: "offline",
      network: true,
      transportId: "2",
    },
    { serial: "emulator-5554", state: "unauthorized", network: false },
  ]);
});
it("reads QR services without mixing their pairing and connect ports", () => {
  expect(
    parseServices(
      "List of discovered mdns services\nstudio-test _adb-tls-pairing._tcp. 192.168.1.3:30000\nadb-ABC _adb-tls-connect._tcp 192.168.1.3:40000\nnoise\n",
    ),
  ).toEqual([
    {
      name: "studio-test",
      type: "_adb-tls-pairing._tcp",
      host: "192.168.1.3",
      port: 30000,
      address: "192.168.1.3:30000",
    },
    {
      name: "adb-ABC",
      type: "_adb-tls-connect._tcp",
      host: "192.168.1.3",
      port: 40000,
      address: "192.168.1.3:40000",
    },
  ]);
});
