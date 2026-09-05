/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ["@atlas/domain", "@atlas/application", "@atlas/database"],
  sassOptions: {
    includePaths: ["./src/app/styles"]
  }
};

export default nextConfig;
