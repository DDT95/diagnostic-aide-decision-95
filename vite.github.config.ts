import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  base: `/${process.env.GITHUB_REPOSITORY?.split("/")[1] || "diagnostic-aide-decision-95"}/`,
  plugins: [react()],
  build: {
    outDir: "dist-github",
    emptyOutDir: true,
  },
});
