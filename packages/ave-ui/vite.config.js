/// <reference types="vitest/config" />
import { defineConfig } from "vite";
import path from "path";
import { fileURLToPath } from "node:url";
import { storybookTest } from "@storybook/addon-vitest/vitest-plugin";
import { playwright } from "@vitest/browser-playwright";
import {
	collectComponentEntries,
} from "./build/entries.js";

const dirname = path.dirname(fileURLToPath(import.meta.url));
const entryFile = path.resolve(dirname, "src/index.ts");
const loaderFile = path.resolve(dirname, "src/loader.ts");
const wordpressEditorUiFile = path.resolve(dirname, "src/wordpress/editor-ui.ts");
const wordpressEditorContentFile = path.resolve(dirname, "src/wordpress/editor-content.ts");
const componentEntries = collectComponentEntries({
	projectRoot: dirname,
});

const buildPresets = {
	es: {
		outDir: "dist",
		emptyOutDir: true,
		modulePreload: {
			resolveDependencies: () => [],
		},
		rollupOptions: {
			preserveEntrySignatures: "strict",
			input: {
				index: entryFile,
				loader: loaderFile,
				'wordpress/editor-ui': wordpressEditorUiFile,
				'wordpress/editor-content': wordpressEditorContentFile,
				...componentEntries,
			},
			external: [],
			output: {
				format: "es",
				entryFileNames: "[name].js",
				chunkFileNames: "chunks/[name]-[hash].js",
			},
		},
		sourcemap: true,
		minify: "esbuild",
	},
	wordpress: {
		lib: {
			entry: entryFile,
			name: "AvenueUI",
			formats: ["iife"],
			fileName: () => "avenue-ui.js",
		},
		outDir: "dist",
		emptyOutDir: false,
		rollupOptions: {
			external: [],
		},
		sourcemap: true,
		minify: "esbuild",
		cssCodeSplit: false,
		target: "es2020",
	},
};

// Single config with mode-based build targets:
// - vite build (default): ES module build
// - vite build --mode wordpress: self-contained WordPress IIFE build
export default defineConfig(({ command, mode }) => {
	const selectedBuild = buildPresets[mode] || buildPresets.es;

	return {
		plugins: [],
		resolve: {
			alias: {
				"@ave-utils": "ave-css/styles/utils",
			},
		},
		optimizeDeps: {
			include: [
				"lit",
				"lit/decorators.js",
				"lit/static-html.js",
				"lit/directives/class-map.js",
				"lit/directives/if-defined.js",
				"lit/directives/when.js",
			],
		},
		build: selectedBuild,
		test: {
			projects: [
				{
					extends: true,
					test: {
						name: "browser",
						include: [
							"tests/browser/**/*.test.ts",
						],
						browser: {
							enabled: true,
							headless: true,
							provider: playwright({}),
							instances: [
								{
									browser: "chromium",
								},
							],
						},
					},
				},
				{
					extends: true,
					plugins: [
						storybookTest({
							configDir: path.join(dirname, ".storybook"),
						}),
					],
					test: {
						name: "storybook",
						browser: {
							enabled: true,
							headless: true,
							provider: playwright({}),
							instances: [
								{
									browser: "chromium",
								},
							],
						},
					},
				},
			],
		},
	};
});
