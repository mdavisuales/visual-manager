/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // exceljs se carga tal cual en el servidor (no se empaqueta) para que funcione bien en las funciones de Netlify
  experimental: { serverComponentsExternalPackages: ["exceljs"] },
};
export default nextConfig;
