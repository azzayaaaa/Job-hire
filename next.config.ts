import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Webpack-ийг хүчээр ашиглах (Turbopack-ийг алгасах)
  webpack: (config) => {
    return config;
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'lh3.googleusercontent.com',
        port: '',
        pathname: '/**',
      },
    ],
  },
};

export default nextConfig;