/** @type {import('next').NextConfig} */
const nextConfig = {
  async rewrites() {
    return [
      // Proxy API calls to gateway — avoids CORS issues in dev
      {
        source: '/api/gateway/:path*',
        destination: 'http://127.0.0.1:3000/:path*',
      },
      // Proxy to policy service
      {
        source: '/api/policy/:path*',
        destination: 'http://127.0.0.1:8001/:path*',
      },
      // Proxy to audit service
      {
        source: '/api/audit/:path*',
        destination: 'http://127.0.0.1:8002/:path*',
      },
      // Proxy to tri-guard
      {
        source: '/api/tri-guard/:path*',
        destination: 'http://127.0.0.1:8000/:path*',
      },
    ];
  },
};

export default nextConfig;
