import { defineConfig } from 'vite';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const rootDir = path.dirname(fileURLToPath(import.meta.url));

const entries = {
	'src/js/main.js': path.resolve(rootDir, 'src/js/main.js'),
	'src/js/editor.js': path.resolve(rootDir, 'src/js/editor.js'),
	'src/css/main.css': path.resolve(rootDir, 'src/css/main.css'),
	'src/css/editor.css': path.resolve(rootDir, 'src/css/editor.css'),
};

export default defineConfig({
	build: {
		outDir: 'dist',
		emptyOutDir: true,
		manifest: true,
		rollupOptions: {
			input: entries,
		},
	},
});
