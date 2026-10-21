import { vi } from "vitest";

// Paseo injects native icons at runtime; behavior tests exercise the surrounding UI.
vi.mock("@getpaseo/plugin/client/react-native", () => ({ Icon: () => null }));
