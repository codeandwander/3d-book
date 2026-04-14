import { defineConfig } from 'vite'

export default defineConfig(({ mode }) => {
  if (mode === 'embed') {
    // Webflow IIFE bundle — single self-mounting script
    return {
      build: {
        lib: {
          entry: 'src/embed.js',
          name: 'Book3D',
          formats: ['iife'],
          fileName: () => 'book.iife.js',
        },
        outDir: 'dist-embed',
        minify: 'esbuild',
        sourcemap: false,
        target: 'es2019',
      },
    }
  }

  // Default: static site build (designer playground, deployable to Vercel)
  return {
    build: {
      outDir: 'dist',
      minify: 'esbuild',
      sourcemap: false,
      target: 'es2019',
    },
  }
})
