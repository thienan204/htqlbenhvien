import type { NextConfig } from "next";

const isProd = process.env.NODE_ENV === 'production';

const nextConfig: NextConfig = {
  output: "standalone",
  basePath: '',
  /* config options here */
  // Forced reload timestamp: 1
};

export default nextConfig;
