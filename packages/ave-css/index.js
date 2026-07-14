import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

import postcssConfig, { createPostcssConfig } from "./postcss.config.js";
import { getLightningCssConfig } from "./vite.config.js";
import functions from "./src/functions/index.js";

const packageRoot = dirname(fileURLToPath(import.meta.url));

export const paths = {
    styles: resolve(packageRoot, "dist/styles/core.css"),
    layers: resolve(packageRoot, "dist/styles/layers.css"),
    breakpoints: resolve(packageRoot, "dist/styles/breakpoints.css"),
    variables: resolve(packageRoot, "dist/styles/variables.css"),
    utils: resolve(packageRoot, "src/styles/utilities/"),
    utilsIndex: resolve(packageRoot, "dist/styles/utils.css"),
    mixins: resolve(packageRoot, "src/mixins/index.css"),
    functions: resolve(packageRoot, "src/functions/index.js"),
    postcss: resolve(packageRoot, "postcss.config.js"),
    browserslist: resolve(packageRoot, ".browserslistrc"),
};

export { createPostcssConfig, functions, getLightningCssConfig, postcssConfig };

export default {
    paths,
    functions,
    postcssConfig,
    createPostcssConfig,
    getLightningCssConfig,
};
