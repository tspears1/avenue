const SELECTORS = {
   copyButton: '#avenue-ui-copy-report',
   copyStatus: '#avenue-ui-copy-status',
   loaderScript: '#avenue-ui-diagnostics-loader',
   report: '#avenue-ui-report',
   row: '.avenue-component-row',
   search: '#avenue-ui-component-search',
   table: '#avenue-ui-components-table',
} as const

/**
 * Initialize the controls available in the current Avenue UI administration
 * view and run component probes when the overview table is present.
 *
 * @param root Document subtree containing the administration view.
 * @returns A promise that resolves after component probes finish.
 */
export async function initializeAdminDiagnostics(
   root: ParentNode = document,
): Promise<void> {
   bindSearch(root)
   bindCopyReport(root)

   const rows = Array.from(
      root.querySelectorAll<HTMLTableRowElement>(
         SELECTORS.row,
      ),
   )

   if (rows.length === 0) {
      return
   }

   const loaderScript = root.querySelector<HTMLScriptElement>(
      SELECTORS.loaderScript,
   )

   await waitForLoader(loaderScript)

   for (const row of rows) {
      await probeRow(row)
   }
}

/**
 * Bind component-table filtering when both search and table controls exist.
 *
 * @param root Document subtree containing the overview controls.
 * @returns Nothing.
 */
function bindSearch(root: ParentNode): void {
   const search = root.querySelector<HTMLInputElement>(
      SELECTORS.search,
   )
   const table = root.querySelector<HTMLTableElement>(
      SELECTORS.table,
   )

   if (
      !search
      || !table
      || search.dataset.avenueBound === '1'
   ) {
      return
   }

   search.dataset.avenueBound = '1'
   search.addEventListener('input', () => {
      const value = search.value.toLowerCase()
      const body = table.tBodies.item(0)

      if (!body) {
         return
      }

      for (const row of body.rows) {
         const text = row.textContent?.toLowerCase() ?? ''
         row.style.display = text.includes(value)
            ? ''
            : 'none'
      }
   })
}

/**
 * Bind diagnostics-report clipboard behavior when its controls exist.
 *
 * @param root Document subtree containing the diagnostics controls.
 * @returns Nothing.
 */
function bindCopyReport(root: ParentNode): void {
   const button = root.querySelector<HTMLButtonElement>(
      SELECTORS.copyButton,
   )
   const status = root.querySelector<HTMLElement>(
      SELECTORS.copyStatus,
   )
   const report = root.querySelector<HTMLElement>(
      SELECTORS.report,
   )

   if (
      !button
      || !status
      || !report
      || button.dataset.avenueBound === '1'
   ) {
      return
   }

   button.dataset.avenueBound = '1'
   button.addEventListener('click', async () => {
      try {
         await navigator.clipboard.writeText(
            report.textContent ?? '{}',
         )
         status.textContent = 'Copied'
      } catch {
         status.textContent = 'Copy failed'
      }
   })
}

/**
 * Wait briefly for the optional component loader to settle.
 *
 * @param loaderScript Component-loader script element, when rendered.
 * @returns A promise that resolves after loading, failure, or timeout.
 */
async function waitForLoader(
   loaderScript: HTMLScriptElement | null,
): Promise<void> {
   if (
      !loaderScript
      || loaderScript.dataset.loaded === '1'
      || loaderScript.dataset.failed === '1'
   ) {
      return
   }

   await new Promise<void>(resolve => {
      let timeout = 0

      const cleanup = () => {
         loaderScript.removeEventListener('load', onLoad)
         loaderScript.removeEventListener('error', onError)
         window.clearTimeout(timeout)
      }
      const finish = (state: 'failed' | 'loaded') => {
         loaderScript.dataset[state] = '1'
         cleanup()
         resolve()
      }
      const onLoad = () => finish('loaded')
      const onError = () => finish('failed')

      loaderScript.addEventListener('load', onLoad, {
         once: true,
      })
      loaderScript.addEventListener('error', onError, {
         once: true,
      })
      timeout = window.setTimeout(() => {
         cleanup()
         resolve()
      }, 2000)
   })
}

/**
 * Probe one component row for registration, definition, rendering mode, and
 * encapsulated styles.
 *
 * @param row Component overview table row.
 * @returns A promise that resolves after the runtime probe.
 */
async function probeRow(
   row: HTMLTableRowElement,
): Promise<void> {
   const tag = row.dataset.tag ?? ''
   const requestedMode = row.dataset.requestedMode ?? 'none'
   const discovered = row.dataset.discovered === '1'
   const registered = row.dataset.registered === '1'
   const enqueued = row.dataset.enqueued === '1'
   const jsCell = cell(row, '.avenue-cell-js-defined')
   const cssCell = cell(row, '.avenue-cell-css')
   const modeCell = cell(row, '.avenue-cell-mode')

   setText(
      cell(row, '.avenue-cell-discovered'),
      tick(discovered),
   )
   setText(
      cell(row, '.avenue-cell-registered'),
      tick(registered),
   )
   setText(
      cell(row, '.avenue-cell-enqueued'),
      tick(enqueued),
   )

   if (!tag) {
      setText(jsCell, '✕')
      setText(cssCell, '—')
      setText(modeCell, 'Not loaded')
      updateSummary(row, false)
      return
   }

   let defined = Boolean(customElements.get(tag))

   if (!defined && enqueued) {
      defined = await waitForDefinition(tag, 2500)
   }

   let hasCss = false
   let mode = requestedMode === 'none'
      ? 'Not loaded'
      : 'Unknown'

   if (defined) {
      let element: HTMLElement | null = null

      try {
         element = document.createElement(tag)
         element.style.position = 'fixed'
         element.style.left = '-9999px'
         element.style.top = '-9999px'
         document.body.append(element)

         await customElements.whenDefined(tag)
         await waitFrame()
         await waitFrame()

         const shadow = element.shadowRoot

         if (shadow) {
            mode = 'Shadow DOM'
            hasCss = (
               shadow.adoptedStyleSheets.length > 0
               || Boolean(shadow.querySelector('style'))
            )
         } else {
            mode = 'Light DOM'
         }
      } catch {
         mode = 'Not loaded'
      } finally {
         element?.remove()
      }
   } else {
      mode = 'Not loaded'
   }

   setText(jsCell, tick(defined))
   setText(cssCell, hasCss ? '✓' : '—')
   setText(modeCell, mode)
   updateSummary(row, defined)
}

/**
 * Calculate and render the component's aggregate diagnostics status.
 *
 * @param row Component overview table row.
 * @param jsDefined Whether the component has a registered custom element.
 * @returns Nothing.
 */
function updateSummary(
   row: HTMLTableRowElement,
   jsDefined: boolean,
): void {
   const discovered = row.dataset.discovered === '1'
   const registered = row.dataset.registered === '1'
   const enqueued = row.dataset.enqueued === '1'
   const hasError = row.dataset.hasError === '1'
   const requestedMode = row.dataset.requestedMode ?? 'none'
   let summary = 'Healthy'

   if (!discovered) {
      summary = 'Unavailable'
   } else if (hasError) {
      summary = 'Misconfigured'
   } else if (requestedMode === 'none') {
      summary = 'Unsupported in current context'
   } else if (!registered || !enqueued || !jsDefined) {
      summary = 'Partially loaded'
   }

   setText(
      cell(row, '.avenue-cell-summary'),
      summary,
   )
}

/**
 * Wait for a custom-element definition up to a maximum duration.
 *
 * @param tag Custom-element tag name.
 * @param maxMs Maximum wait duration in milliseconds.
 * @returns Whether the element became defined.
 */
async function waitForDefinition(
   tag: string,
   maxMs: number,
): Promise<boolean> {
   const start = Date.now()

   while (Date.now() - start < maxMs) {
      if (customElements.get(tag)) {
         return true
      }

      await wait(100)
   }

   return Boolean(customElements.get(tag))
}

/**
 * Resolve a diagnostics cell inside a component row.
 *
 * @param row Component overview table row.
 * @param selector Cell selector.
 * @returns The matching cell, or null.
 */
function cell(
   row: HTMLTableRowElement,
   selector: string,
): HTMLElement | null {
   return row.querySelector<HTMLElement>(selector)
}

/**
 * Set text when an optional diagnostics cell exists.
 *
 * @param element Element to update.
 * @param value Text value.
 * @returns Nothing.
 */
function setText(
   element: HTMLElement | null,
   value: string,
): void {
   if (element) {
      element.textContent = value
   }
}

/**
 * Convert a boolean state into a diagnostics mark.
 *
 * @param value State value.
 * @returns A success or failure mark.
 */
function tick(value: boolean): string {
   return value ? '✓' : '✕'
}

/**
 * Wait for one animation frame.
 *
 * @returns A promise resolved on the next animation frame.
 */
function waitFrame(): Promise<void> {
   return new Promise(resolve => {
      requestAnimationFrame(() => resolve())
   })
}

/**
 * Wait for a duration.
 *
 * @param milliseconds Wait duration in milliseconds.
 * @returns A promise resolved after the duration.
 */
function wait(milliseconds: number): Promise<void> {
   return new Promise(resolve => {
      window.setTimeout(resolve, milliseconds)
   })
}

/**
 * Initialize after the document is ready when this file runs as its Vite
 * administration entry.
 *
 * @returns Nothing.
 */
function boot(): void {
   void initializeAdminDiagnostics()
}

if (document.readyState === 'loading') {
   document.addEventListener(
      'DOMContentLoaded',
      boot,
      { once: true },
   )
} else {
   boot()
}
