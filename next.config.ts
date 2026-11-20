import type { NextConfig } from "next"

// GitHub Pages serves the repo at /hearthlane. Local dev stays at the root.
const basePath = process.env.GITHUB_ACTIONS === "true" ? "/hearthlane" : ""

const nextConfig: NextConfig = {
  output: "export",
  trailingSlash: true,
  basePath,
  images: { unoptimized: true },
  allowedDevOrigins: ["127.0.0.1", "localhost", "[::1]"],
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
}

export default nextConfig
