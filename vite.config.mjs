import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  base: process.env.ELECTRON === "true" ? "./" : "/making_timetable/",
});
