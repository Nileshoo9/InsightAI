import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  webpack: (config, { isServer }) => {
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        https: false,
        http: false,
        url: false,
        path: false,
        buffer: false,
        stream: false,
        os: false,
      };

      // Specifically for node: schemes (Webpack 5 workaround)
      config.externals = [
        ...(config.externals || []),
        { "node:fs": "null", "node:https": "null", "node:url": "null", "node:path": "null" }
      ];
    }
    return config;
  },
};

export default nextConfig;
