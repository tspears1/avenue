type ComponentModule = Record<string, unknown>
type ComponentImporter = () => Promise<ComponentModule>

type LoadComponentsOptions = {
   continueOnError?: boolean
   onError?: (
      component: string,
      error: unknown
   ) => void
}

const componentModules = import.meta.glob(
   './components/*/*.lit.ts'
) as Record<string, ComponentImporter>

const componentLoaders = buildComponentLoaderMap(
   componentModules
)

/**
 * Return all available component keys for dynamic loading.
 */
export function getAvailableComponents(): string[] {
   return Object.keys(componentLoaders).sort()
}

/**
 * Check if a component can be loaded by key/tag.
 */
export function hasComponent(
   component: string
): boolean {
   return Boolean(resolveComponentKey(component))
}

/**
 * Load one component module by key/tag.
 */
export async function loadComponent(
   component: string
): Promise<void> {
   const key = resolveComponentKey(component)

   if (!key) {
      throw new Error(
         `Unknown component "${component}".`
      )
   }

   await componentLoaders[key]()
}

/**
 * Load multiple component modules.
 */
export async function loadComponents(
   components: string[],
   options: LoadComponentsOptions = {}
) {
   const {
      continueOnError = true,
      onError,
   } = options

   const loaded: string[] = []
   const failed: Array<{
      component: string
      error: unknown
   }> = []

   for (const component of components) {
      try {
         await loadComponent(component)
         loaded.push(component)
      } catch (error) {
         failed.push({
            component,
            error,
         })

         if (typeof onError === 'function') {
            onError(component, error)
         }

         if (!continueOnError) {
            throw error
         }
      }
   }

   return {
      loaded,
      failed,
   }
}

function buildComponentLoaderMap(
   importers: Record<string, ComponentImporter>
): Record<string, ComponentImporter> {
   const loaderMap: Record<string, ComponentImporter> = {}

   for (const [modulePath, importer] of Object.entries(
      importers
   )) {
      const key = extractComponentKey(modulePath)

      if (!key) {
         continue
      }

      loaderMap[key] = importer
   }

   return loaderMap
}

function extractComponentKey(
   modulePath: string
): string | null {
   const match = modulePath.match(
      /^\.\/components\/([^/]+)\/[^/]+\.lit\.ts$/
   )

   return match?.[1] ?? null
}

function resolveComponentKey(
   component: string
): string | null {
   const normalized = normalizeComponentKey(component)

   return componentLoaders[normalized]
      ? normalized
      : null
}

function normalizeComponentKey(
   component: string
): string {
   return String(component)
      .trim()
      .toLowerCase()
      .replace(/^ave-/, '')
      .replace(/^components\//, '')
      .replace(/\.lit$/, '')
}
