import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: { port: 4731, strictPort: true, host: "0.0.0.0" },
  preview: { port: 4731, strictPort: true, host: "0.0.0.0" },
  test: {
    environment: "node",
    include: ["src/test/**/*.test.ts"],
  },
});
