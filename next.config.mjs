/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverComponentsExternalPackages: [
      '@prisma/client',
      'bcryptjs',
      'ssh2',
      'ssh2-sftp-client',
    ],
  },
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: '**' },
    ],
  },
}

export default nextConfig
