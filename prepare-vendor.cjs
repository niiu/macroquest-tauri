const fs = require('node:fs');
fs.mkdirSync('vendor', {recursive:true});
require('esbuild').buildSync({stdin:{contents:"import Editor from '@toast-ui/editor'; import '@toast-ui/editor/dist/i18n/ru-ru'; window.toastui={Editor};",resolveDir:process.cwd()},bundle:true,minify:true,format:'iife',outfile:'vendor/toastui-editor-all.min.js'});
fs.copyFileSync('node_modules/@toast-ui/editor/dist/toastui-editor.css','vendor/toastui-editor.min.css');
fs.copyFileSync('node_modules/@toast-ui/editor/dist/theme/toastui-editor-dark.css','vendor/toastui-editor-dark.css');
