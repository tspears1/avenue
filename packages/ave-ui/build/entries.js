import fs from "node:fs";
import path from "node:path";

/**
 * Collect component entry files for ES builds.
 *
 * Scans src/components recursively for *.lit.ts files and returns
 * a Rollup input map keyed by src-relative module path.
 */
export function collectComponentEntries({
	projectRoot,
	sourceRoot = "src",
	componentsDirectory = "components",
}) {
	const sourcePath = path.join(projectRoot, sourceRoot);
	const componentRoot = path.join(sourcePath, componentsDirectory);

	const entries = {};

	function walk(directory) {
		for (const entry of fs.readdirSync(directory, {
			withFileTypes: true,
		})) {
			const fullPath = path.join(directory, entry.name);

			if (entry.isDirectory()) {
				walk(fullPath);
				continue;
			}

			if (!entry.name.endsWith(".lit.ts")) {
				continue;
			}

			const relativeToProject = path.relative(projectRoot, fullPath);

			const entryName = relativeToProject
				.replace(/^src\//, "")
				.replace(/\.ts$/, "");

			entries[entryName] = fullPath;
		}
	}

	if (fs.existsSync(componentRoot)) {
		walk(componentRoot);
	}

	return entries;
}

/**
 * Mark lit runtime modules as externals for ES output.
 */
export function isEsExternal(id) {
	return (
		id === "lit" ||
		id.startsWith("lit/") ||
		id === "lit-html" ||
		id.startsWith("lit-html/") ||
		id === "@lit/reactive-element" ||
		id.startsWith("@lit/reactive-element/")
	);
}
