/** @type {import('next').NextConfig} */
const nextConfig = {
  compiler: {
    styledJsx: true,
  },
  async rewrites() {
    return [
      // Proxy API calls to gateway — avoids CORS issues in dev
      {
        source: '/api/gateway/:path*',
        destination: 'http://localhost:3000/:path*',
      },
      // Proxy to policy service
      {
        source: '/api/policy/:path*',
        destination: 'http://localhost:8001/:path*',
      },
      // Proxy to audit service
      {
        source: '/api/audit/:path*',
        destination: 'http://localhost:8002/:path*',
      },
      // Proxy to tri-guard
      {
        source: '/api/tri-guard/:path*',
        destination: 'http://localhost:8000/:path*',
      },
    ];
  },
};

export default nextConfig;
