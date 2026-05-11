import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Keep the dev server on Webpack because Turbopack is panicking on this Windows workspace.
  webpack: (config) => {
    return config;
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "lh3.googleusercontent.com",
        port: "",
        pathname: "/**",
      },
    ],
  },
};

export default nextConfig;
