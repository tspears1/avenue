import browserslist from 'browserslist'
import { browserslistToTargets } from 'lightningcss'

/**
 * Shared LightningCSS configuration for Vite projects
 *
 * Usage in vite.config.js:
 * import { getLightningCssConfig } from 'ave-css/vite'
 *
 * export default defineConfig({
 *   css: getLightningCssConfig(),
 *   // ... other config
 * })
 */
export function getLightningCssConfig() {
    return {
        transformer: 'lightningcss',
        lightningcss: {
            targets: browserslistToTargets(browserslist()),
            drafts: {
                customMedia: true,
            },
        },
    }
}

/**
 * Alternative: Use PostCSS pipeline (recommended for better compatibility)
 *
 * Just create a postcss.config.js in your package:
 * export { default } from 'ave-css/postcss'
 */
