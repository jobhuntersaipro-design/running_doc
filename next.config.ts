import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      // Race uploads in /admin: GPX, route map PDF and cover image. Vercel caps request bodies at 4.5 MB.
      bodySizeLimit: "4.5mb",
    },
  },
};

export default nextConfig;
