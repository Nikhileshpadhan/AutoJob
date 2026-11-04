import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["@libsql/client", "pdf-parse", "playwright"],
  experimental: {
    optimizePackageImports: ["lucide-react"],
  },
};

export default nextConfig;
