const { randomUUID } = require("node:crypto");

// Shared with child build workers; compiled into both browser and API bundles.
const appBuildId = process.env.MAMORU_APP_BUILD_ID || randomUUID();
process.env.MAMORU_APP_BUILD_ID = appBuildId;

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: false,
  env: { NEXT_PUBLIC_APP_BUILD_ID: appBuildId },
  generateBuildId: async () => appBuildId,
};

module.exports = nextConfig;
