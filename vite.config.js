import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  build: {
    chunkSizeWarningLimit: 1800,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes("node_modules")) {
            if (id.includes("firebase")) return "firebase";
            if (id.includes("recharts")) return "recharts";
            if (id.includes("lucide-react")) return "lucide";
            if (id.includes("jspdf")) return "jspdf";
            return "vendor";
          }
        }
      }
    }
  }
});
