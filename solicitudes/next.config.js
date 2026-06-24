/** @type {import('next').NextConfig} */

// Para GitHub Pages de PROYECTO el sitio vive en /<repo>, así que se necesita
// basePath. Se define en build con NEXT_PUBLIC_BASE_PATH (lo inyecta el workflow).
// Para dominio propio o repo <usuario>.github.io, déjalo vacío.
const basePath = process.env.NEXT_PUBLIC_BASE_PATH || "";

const nextConfig = {
  // Exporta un sitio 100% estático (SPA) → se publica en GitHub Pages.
  output: "export",
  reactStrictMode: true,
  trailingSlash: true,
  basePath: basePath || undefined,
  assetPrefix: basePath || undefined,
  images: {
    // GitHub Pages no tiene el optimizador de imágenes de Next.
    unoptimized: true
  }
};

module.exports = nextConfig;
