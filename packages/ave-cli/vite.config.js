import { defineConfig } from 'vite';
import { resolve } from 'node:path';

export default defineConfig({
	build: {
		outDir: 'dist',
		emptyOutDir: true,
		lib: {
			entry: resolve(__dirname, 'src/main.js'),
			formats: ['es'],
			fileName: () => 'index.js',
		},
		rollupOptions: {
			external: ['@clack/prompts', 'kleur', 'semver'],
		},
	},
});
