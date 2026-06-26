import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig } from 'vite';

export default defineConfig(() => {
  return {
    plugins: [react(), tailwindcss()],

    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },

    build: {
      // Gera hashes únicos por conteúdo em todos os arquivos
      // Ex: assets/index-Ab3Cd4Ef.js → se mudar, hash muda → browser baixa novo
      rollupOptions: {
        output: {
          // Hash baseado no conteúdo (muda só quando o arquivo muda)
          entryFileNames:  'assets/[name]-[hash].js',
          chunkFileNames:  'assets/[name]-[hash].js',
          assetFileNames:  'assets/[name]-[hash].[ext]',

          // Divide em chunks menores para cache mais granular
          // Ex: React não muda entre deploys → fica em cache separado
          manualChunks(id) {
            if (id.includes('node_modules')) {
              // Vendors principais em chunk separado
              if (id.includes('react') || id.includes('react-dom')) {
                return 'vendor-react';
              }
              if (id.includes('framer-motion') || id.includes('motion')) {
                return 'vendor-motion';
              }
              if (id.includes('lucide')) {
                return 'vendor-icons';
              }
              if (id.includes('@supabase')) {
                return 'vendor-supabase';
              }
              // Demais dependências
              return 'vendor';
            }
          },
        },
      },

      // Tamanho máximo de chunk antes de avisar (500kb)
      chunkSizeWarningLimit: 500,

      // Sourcemaps em produção (ajuda no debug sem expor código)
      sourcemap: false,
    },

    server: {
      hmr: process.env.DISABLE_HMR !== 'true',
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
