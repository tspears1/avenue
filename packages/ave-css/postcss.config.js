import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

import postcssImport from "postcss-import";
import postcssNesting from "postcss-nesting";
import postcssMixins from "postcss-mixins";
import postcssAdvancedVariables from "postcss-advanced-variables";
import postcssFunctions from "postcss-functions";
import postcssLightningcss from "postcss-lightningcss";

import functions from "./src/functions/index.js";

const packageRoot = dirname(fileURLToPath(import.meta.url));
const defaultMixinsDir = resolve(packageRoot, "src/mixins");

export function createPostcssConfig(options = {}) {
    const {
        mixinsDir = defaultMixinsDir,
        additionalMixins = {},
        additionalFunctions = {},
        importOptions = {},
        nestingOptions = {},
        lightningcssOptions = {},
    } = options;

    return {
        plugins: [
            postcssImport(importOptions),
            postcssMixins({
                mixinsDir,
                mixins: additionalMixins,
            }),
            postcssAdvancedVariables(),
            postcssFunctions({
                functions: {
                    ...functions,
                    ...additionalFunctions,
                },
            }),
            postcssNesting(nestingOptions),
            postcssLightningcss({
                lightningcssOptions: {
                    drafts: {
                        customMedia: true,
                    },
                    ...lightningcssOptions,
                },
            }),
        ],
    };
}

export default createPostcssConfig();
