/// <reference types="vitest/config" />
import { defineConfig } from "vite";
import path from "path";
import { fileURLToPath } from "node:url";
import { storybookTest } from "@storybook/addon-vitest/vitest-plugin";
import { playwright } from "@vitest/browser-playwright";

const dirname = path.dirname(fileURLToPath(import.meta.url));
const entryFile = path.resolve(dirname, "src/index.ts");

const buildPresets = {
	es: {
		lib: {
			entry: entryFile,
			name: "AvenueUI",
			formats: ["es"],
			fileName: () => "avenue-ui.js",
		},
		outDir: "dist",
		emptyOutDir: true,
		codeSplitting: false,
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
		build: selectedBuild,
		test: {
			projects: [
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
