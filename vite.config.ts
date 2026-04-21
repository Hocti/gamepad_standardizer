import { defineConfig } from 'vite';
import basicSsl from '@vitejs/plugin-basic-ssl';
import dts from 'vite-plugin-dts';
import repo from "./package.json" assert { type: 'json' };

export default defineConfig(({ command }) => {
  if (command === 'build') {
    return {
      plugins: [
        dts({
          include: ['src/**/*.ts'],
          rollupTypes: true
        })
      ],
      build: {
        lib: {
          entry: 'src/index.ts',
          name: 'GamepadStandardizer',
          formats: ['es', 'iife'],
          fileName: (format) => (format === 'es' ? repo.module : repo.unpkg)
        },
        sourcemap: true,
        emptyOutDir: true
      }
    };
  }

  return {
    root: 'demo',
    server: { https: true, port: 5174 },
    plugins: [basicSsl()]
  };
});
