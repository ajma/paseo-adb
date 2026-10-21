import { defineConfig } from "vitest/config";
export default defineConfig({
  resolve: {
    alias: [{ find: /^react-native$/, replacement: "react-native-web" }],
  },
  test: {
    environment: "node",
    include: [
      "shared/**/*.test.ts",
      "server/**/*.test.ts",
      "client/**/*.test.tsx",
    ],
  },
});
