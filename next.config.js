/** @type {import('next').NextConfig} */
const nextConfig = {
  eslint: {
    ignoreDuringBuilds: true,
  },
  webpack(config) {
    // Prevent webpack from trying to bundle Node-only ONNX bindings
    // when @huggingface/transformers is dynamically imported client-side
    config.resolve.alias['onnxruntime-node$'] = false
    config.resolve.alias['sharp$'] = false
    return config
  },
};

module.exports = nextConfig;