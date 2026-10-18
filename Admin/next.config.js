/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Behind nginx + Front on same host: must not use '/admin' — Next strips assetPrefix
  // from the request path, so /admin/login would become /login → 404.
  // HTML → /_va/_next/... ; nginx → Admin :3020 /_next/...
  assetPrefix: process.env.NODE_ENV === 'production' ? '/_va' : undefined,
  transpilePackages: [
    'react-quill',
    '@vspomni/order-chat-core',
    '@vspomni/order-chat-ui',
  ],
  // Согласовано с Nest VIDEO_MAX (80 МБ) и nginx client_max_body_size 100m
  experimental: {
    serverActions: {
      bodySizeLimit: '100mb',
    },
  },
};

module.exports = nextConfig;
