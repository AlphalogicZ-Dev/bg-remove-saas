/** @type {import('next').NextConfig} */
const nextConfig = {
  eslint: {
    ignoreDuringBuilds: true,
  },
  webpack(config) {
    // @huggingface/transformers is loaded at runtime from /lib/transformers.web.min.js
    // (a static file in /public) via a webpackIgnore dynamic import in mobileSam.ts.
    // Stub the npm package name so webpack never tries to bundle it.
    config.resolve.alias['@huggingface/transformers'] = false
    config.resolve.alias['onnxruntime-node'] = false
    config.resolve.alias['sharp'] = false
    return config
  },
};

module.exports = nextConfig;