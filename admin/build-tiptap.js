const esbuild = require('esbuild');

esbuild.build({
  entryPoints: ['src/tiptap-entry.js'],
  bundle: true,
  format: 'esm',
  outfile: 'public/js/tiptap-bundle.js',
  minify: false,
  platform: 'browser',
  target: ['es2020'],
  external: [],
}).then(() => console.log('TipTap bundle generado'))
  .catch(() => process.exit(1));
