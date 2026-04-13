/** @type {import('next').NextConfig} */
const nextConfig = {
  // Required for @imgly/background-removal WASM to work in browser
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'Cross-Origin-Opener-Policy', value: 'same-origin' },
          { key: 'Cross-Origin-Embedder-Policy', value: 'require-corp' },
        ],
      },
    ]
  },
  webpack(config) {
    config.experiments = { ...config.experiments, asyncWebAssembly: true }
    return config
  },
}

module.exports = nextConfig
