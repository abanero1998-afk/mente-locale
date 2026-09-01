/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  async rewrites() {
    return [
      { source: '/logo-mark.jpg', destination: '/api/logo?id=logoMark' },
      { source: '/icons/icon-180.jpg', destination: '/api/logo?id=icon180' },
      { source: '/icons/icon-192.jpg', destination: '/api/logo?id=icon192' },
      { source: '/icons/icon-512.jpg', destination: '/api/logo?id=icon192' },
    ]
  },
}

module.exports = nextConfig
