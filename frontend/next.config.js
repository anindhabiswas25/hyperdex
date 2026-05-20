/** @type {import('next').NextConfig} */
const nextConfig = {
  webpack: (config, { isServer }) => {
    if (!isServer) {
      // Exclude Node.js native modules that are only used server-side.
      // @stellar/stellar-sdk uses sodium-native for signing on Node.js,
      // but falls back to tweetnacl in the browser — so we stub it out.
      config.resolve.alias = {
        ...config.resolve.alias,
        'sodium-native': false,
        'require-addon': false,
      };
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        net: false,
        tls: false,
        'node:crypto': false,
        'node:buffer': false,
        'node:stream': false,
        'node:util': false,
        'node:net': false,
        'node:tls': false,
        'node:fs': false,
        'node:path': false,
        'node:os': false,
        'node:http': false,
        'node:https': false,
        'node:zlib': false,
        'node:events': false,
        'node:url': false,
        'node:process': false,
        'node:querystring': false,
        'node:assert': false,
        'node:string_decoder': false,
      };
    }
    return config;
  },
};

module.exports = nextConfig;
