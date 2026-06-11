import { reactRouter } from "@react-router/dev/vite";
import { defineConfig, loadEnv } from "vite";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig(({ mode }) => {
  const env = { ...loadEnv(mode, ".", ""), ...process.env };
  const apiTarget = env.API_URL ?? `http://localhost:${env.API_PORT ?? 4000}`;
  return {
    plugins: [reactRouter(), tsconfigPaths()],
    server: {
      host: true,
      port: Number(env.WEB_PORT ?? 3030),
      proxy: {
        "/api": apiTarget,
      },
    },
  };
});
