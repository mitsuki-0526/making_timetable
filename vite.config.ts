import path from "node:path";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// https://vitejs.dev/config/
const isDesktopBuild =
  process.env.ELECTRON === "true" || process.env.TAURI_ENV_PLATFORM != null;

export default defineConfig({
  plugins: [react(), tailwindcss()],
  base: isDesktopBuild ? "./" : "/making_timetable/",
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
