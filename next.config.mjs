/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "standalone",
  reactStrictMode: false,
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
