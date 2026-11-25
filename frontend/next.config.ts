import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // cacheComponents requires route segments to avoid `export const dynamic`.
  // Since our pages are all client components fetching at runtime, we disable it.
  cacheComponents: false,
};

export default nextConfig;
