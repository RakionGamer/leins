import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { fileURLToPath, URL } from 'node:url';

const resolvePath = path => {
   return fileURLToPath(new URL(path, import.meta.url));
};

export default defineConfig({
   plugins: [
      react(),
   ],

   resolve: {
      alias: {
         app: resolvePath('./src/app'),
         components: resolvePath('./src/components'),
         context: resolvePath('./src/context'),
         hooks: resolvePath('./src/hooks'),
         layouts: resolvePath('./src/layouts'),
         pages: resolvePath('./src/pages'),
         routes: resolvePath('./src/routes'),
         services: resolvePath('./src/services'),
         utils: resolvePath('./src/utils'),
      },
   },

   server: {
      host: 'localhost',
      port: 3000,
      strictPort: true,
      open: true,
   },

   preview: {
      port: 3000,
      strictPort: true,
      open: true,
   },

   build: {
      outDir: 'build',
      emptyOutDir: true,
   },

   test: {
      environment: 'jsdom',
      globals: true,
      setupFiles: './src/setupTests.js',
   },
});
