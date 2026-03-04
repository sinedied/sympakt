import { defineConfig } from 'vite';
import { viteSingleFile } from 'vite-plugin-singlefile';
import { ViteMinifyPlugin } from 'vite-plugin-minify';
import minifyHTMLLiterals from 'rollup-plugin-minify-html-literals-v3';

export default defineConfig({
  base: './',
  build: {
    outDir: 'dist',
    target: 'esnext',
    assetsInlineLimit: Infinity,
  },
  plugins: [
    minifyHTMLLiterals({
      options: {
        minifyOptions: {
          keepClosingSlash: true,
        },
      },
    }),
    viteSingleFile(),
    ViteMinifyPlugin({
      collapseWhitespace: true,
      removeComments: true,
      minifyCSS: true,
      minifyJS: false, // Already minified by Vite/esbuild
    }),
  ],
});
