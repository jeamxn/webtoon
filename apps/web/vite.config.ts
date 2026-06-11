import { reactRouter } from "@react-router/dev/vite";
import { defineConfig } from "vite";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig({
  plugins: [reactRouter(), tsconfigPaths()],
  server: {
    port: 3000,
    proxy: {
      "/api": "http://localhost:4000",
      "/files": "http://localhost:4000",
    },
  },
});
