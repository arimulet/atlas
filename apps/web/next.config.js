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
