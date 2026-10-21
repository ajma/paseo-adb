import type { Device } from "../shared/contracts";
import { parseEndpoint, type Endpoint } from "../shared/endpoint";

export type Service = Endpoint & { name: string; type: string };
export function parseDevices(output: string): Device[] {
  return output.split(/\r?\n/).flatMap((line) => {
    const trimmed = line.trim();
    if (
      !trimmed ||
      trimmed.startsWith("List of devices") ||
      trimmed.startsWith("*")
    )
      return [];
    const [serial, state, ...fields] = trimmed.split(/\s+/);
    if (!serial || !state) return [];
    const props = Object.fromEntries(
      fields
        .filter((f) => f.includes(":"))
        .map((f) => {
          const i = f.indexOf(":");
          return [f.slice(0, i), f.slice(i + 1)];
        }),
    );
    return [
      {
        serial,
        state: state === "no" ? "no permissions" : state,
        network: serial.includes(":") || serial.includes("._adb"),
        ...(props.model ? { model: props.model.replace(/_/g, " ") } : {}),
        ...(props.product ? { product: props.product } : {}),
        ...(props.transport_id ? { transportId: props.transport_id } : {}),
      },
    ];
  });
}
export function parseServices(output: string): Service[] {
  return output.split(/\r?\n/).flatMap((line) => {
    const match =
      /^\s*(\S+)\s+(_adb(?:-tls-(?:pairing|connect))?\._tcp)\.?\s+(\S+)\s*$/.exec(
        line,
      );
    if (!match) return [];
    try {
      return [{ name: match[1], type: match[2], ...parseEndpoint(match[3]) }];
    } catch {
      return [];
    }
  });
}
