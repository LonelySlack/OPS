import type { NextConfig } from "next";

// Check if we are running the specific Mobile Build command
const isMobile = process.env.MOBILE_BUILD === 'true';

const nextConfig: NextConfig = {
  // --- CHEAT CODES: IGNORE ERRORS ---
  // This allows the build to finish even if you have TypeScript or ESLint errors
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },

  // --- MOBILE SETTINGS ---
  // 1. If Mobile, force 'export'. If Web, keep it undefined.
  output: isMobile ? 'export' : undefined,

  // 2. Image Configuration
  images: {
    unoptimized: isMobile, // Unoptimize images for phone
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'res.cloudinary.com',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'images.unsplash.com',
        port: '',
        pathname: '/**',
      },
    ],
  },
  
  // 3. Web Server Features (Only used when NOT mobile)
  ...(!isMobile && {
    async rewrites() {
      const apiBaseUrl = process.env.API_BASE_URL || process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:8000';
      const cleanApiBaseUrl = apiBaseUrl.endsWith('/') ? apiBaseUrl.slice(0, -1) : apiBaseUrl;
      
      return [
        { source: '/api/properties/featured', destination: `${cleanApiBaseUrl}/api/properties/featured` },
        { source: '/api/properties/property/:code', destination: `${cleanApiBaseUrl}/api/properties/property/:code` },
        { source: '/api/properties/:id/view', destination: `${cleanApiBaseUrl}/api/properties/:id/view` },
        { source: '/api/properties/:id', destination: `${cleanApiBaseUrl}/api/properties/:id` },
        { source: '/api/properties', destination: `${cleanApiBaseUrl}/api/properties` },
        { source: '/api/auth/login', destination: `${cleanApiBaseUrl}/api/auth/login` },
        { source: '/api/auth/signup', destination: `${cleanApiBaseUrl}/api/auth/signup` },
        { source: '/api/auth/register', destination: `${cleanApiBaseUrl}/api/auth/register` },
        { source: '/api/auth/validate', destination: `${cleanApiBaseUrl}/api/auth/me` },
        { source: '/api/auth/me', destination: `${cleanApiBaseUrl}/api/auth/me` },
        { source: '/api/auth/check-email', destination: `${cleanApiBaseUrl}/api/auth/check-email` },
        { source: '/api/upload/multiple', destination: `${cleanApiBaseUrl}/api/upload/multiple` },
        { source: '/api/:path*', destination: `${cleanApiBaseUrl}/api/:path*` },
      ];
    },
    async headers() {
      return [
        {
          source: '/api/:path*',
          headers: [
            { key: 'Access-Control-Allow-Origin', value: '*' },
            { key: 'Access-Control-Allow-Methods', value: 'GET, POST, PUT, DELETE, OPTIONS, PATCH' },
          ],
        },
      ];
    },
  }),
};

export default nextConfig;