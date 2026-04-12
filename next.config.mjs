function toRemotePattern(rawUrl) {
  if (!rawUrl) return null;
  try {
    const url = new URL(rawUrl);
    return {
      protocol: url.protocol.replace(":", ""),
      hostname: url.hostname,
      port: url.port || "",
      pathname: "/**",
    };
  } catch {
    return null;
  }
}

const remotePatterns = [
  toRemotePattern(process.env.NEXT_PUBLIC_API_URL),
  toRemotePattern(process.env.NEXT_PUBLIC_MEDIA_URL),
  toRemotePattern(process.env.NEXT_PUBLIC_R2_PUBLIC_DOMAIN),
].filter(Boolean);

/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns,
  },
};

export default nextConfig;
