import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "standalone",
  outputFileTracingRoot: path.join(__dirname, "../../"),
  reactStrictMode: false,
  transpilePackages: ["@atlas/domain", "@atlas/application", "@atlas/database"],
  sassOptions: {
    includePaths: ["./src/app/styles"]
  },
  async rewrites() {
    const apiUrl = process.env.ATLAS_API_URL || "http://127.0.0.1:3001";
    return [
      {
        source: "/api/:path*",
        destination: `${apiUrl}/api/:path*`
      }
    ];
  },
  webpack: (config) => {
    config.resolve.extensionAlias = {
      ".js": [".ts", ".tsx", ".js"],
      ".jsx": [".tsx", ".jsx"],
      ".mjs": [".mts", ".mjs"]
    };
    return config;
  },
  turbopack: {
    resolveAlias: {
      "*.js": ["*.ts", "*.tsx", "*.js"]
    }
  }
};

export default nextConfig;
