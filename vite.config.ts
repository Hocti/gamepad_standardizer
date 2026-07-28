/// <reference types="vitest/config" />
import { readFileSync } from 'node:fs';
import { defineConfig, type Plugin } from 'vite';
import basicSsl from '@vitejs/plugin-basic-ssl';
import dts from 'vite-plugin-dts';
import { vitestBase } from '@mono/configs/vitest.base';
import repo from "./package.json" with { type: 'json' };

// Ship src/db/local_override.txt to dist/db/local_override.txt, byte-for-byte and un-hashed.
// localOverride.ts fetches it at `new URL('db/local_override.txt', import.meta.url)`, which
// resolves next to whichever entry is in use — src/ in the "development" condition, dist/ when
// built — so the path shape has to match on both sides. The name must stay stable for users
// who edit the file in place, which is why this is a plain copy and not an asset import.
const copyLocalOverrideTxt = (): Plugin => ({
  name: 'copy-local-override-txt',
  generateBundle() {
    this.emitFile({
      type: 'asset',
      fileName: 'db/local_override.txt',
      source: readFileSync('src/db/local_override.txt', 'utf8')
    });
  }
});

const compiled = (new Date()).toUTCString().replace(/GMT/g, "UTC");
const banner = `/*!
 * ${repo.name} - v${repo.version}
 * By ${repo.author}
 * Compiled ${compiled}
 *
 * ${repo.name} is licensed under the MIT license.
 * http://www.opensource.org/licenses/mit-license
 */`;

export default defineConfig(({ command, mode }) => {
  if (mode === 'test' || process.env.VITEST) {
    return { test: vitestBase };
  }

  if (command === 'build') {
    return {
      plugins: [
        dts({
          include: ['src/**/*.ts'],
          rollupTypes: true
        }),
        copyLocalOverrideTxt()
      ],
      build: {
        lib: {
          entry: 'src/index.ts',
          name: 'GamepadStandardizer',
          formats: ['es', 'iife'],
          fileName: (format) => (format === 'es' ? repo.module : repo.unpkg).replace(/^\.\/dist\//, '')
        },
        rollupOptions: {
          // External, not inlined: gamepad_fonts *installs* a `<style id="gamepad-fonts-face">`
          // and only the first copy to run wins. An app that also imports gamepad_fonts (or
          // domgameui, which does) would otherwise carry two copies, and once those two were
          // built against different glyph tables it would render one version's codepoints
          // against the other version's font faces — blank boxes instead of buttons.
          external: ['gamepad_fonts'],
          output: { banner: () => banner, globals: { gamepad_fonts: 'GamepadFonts' } },
          // The iife build has no import.meta; localOverride.ts detects that and falls back to
          // document.currentScript.src. The warning is about the case we already handle.
          onwarn(warning, warn) {
            if (warning.code === 'EMPTY_IMPORT_META') return;
            warn(warning);
          }
        },
        emptyOutDir: true
      }
    };
  }

  return {
    root: 'demo',
    server: { https: {}, port: 5174 },
    plugins: [basicSsl()]
  };
});
