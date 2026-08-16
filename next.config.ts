import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  turbopack: {
    root: __dirname,
  },
  // These resolve their bundled binaries relative to their own __dirname at
  // runtime — bundling them rewrites that path and breaks it (manifested as
  // spawn .../ROOT/node_modules/... ENOENT). Keep them as plain `require`s.
  serverExternalPackages: ["ffmpeg-static", "ffprobe-static"],
};

export default nextConfig;
