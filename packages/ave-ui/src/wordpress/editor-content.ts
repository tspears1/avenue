import { loadComponents } from '../loader'

/**
 * Boot component loading for the block editor content realm.
 */
async function bootEditorContent() {
   const components = getRequestedComponents()

   if (components.length === 0) {
      return
   }

   await loadComponents(components, {
      continueOnError: true,
      onError(component, error) {
         console.error(
            `[AvenueUI] Failed to load component "${component}" in block editor content.`,
            error
         )
      },
   })
}

/**
 * Parse requested component keys from this module URL.
 *
 * Expected query format:
 *   ?components=button,card
 */
function getRequestedComponents(): string[] {
   const url = new URL(import.meta.url)
   const raw = url.searchParams.get('components')

   if (!raw) {
      return []
   }

   return raw
      .split(',')
      .map((component) => component.trim())
      .filter(Boolean)
}

void bootEditorContent()
