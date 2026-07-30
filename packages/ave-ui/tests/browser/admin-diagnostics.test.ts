import {
   afterEach,
   describe,
   expect,
   it,
   vi,
} from 'vitest'

import {
   initializeAdminDiagnostics,
} from '../../src/WordPress/GUI/assets/admin-diagnostics'

const testTag = 'ave-admin-diagnostics-test'

if (!customElements.get(testTag)) {
   customElements.define(
      testTag,
      class extends HTMLElement {
         constructor() {
            super()

            const shadow = this.attachShadow({
               mode: 'open',
            })

            shadow.innerHTML = '<style>:host { display: block; }</style>'
         }
      },
   )
}

afterEach(() => {
   document.body.replaceChildren()
   vi.restoreAllMocks()
})

describe('Admin diagnostics', () => {
   it('filters component rows by their rendered content', async () => {
      document.body.innerHTML = `
         <input id="avenue-ui-component-search" type="search">
         <table id="avenue-ui-components-table">
            <tbody>
               <tr class="avenue-component-row">
                  <td>Button</td>
               </tr>
               <tr class="avenue-component-row">
                  <td>Card</td>
               </tr>
            </tbody>
         </table>
      `

      await initializeAdminDiagnostics()

      const search = document.querySelector<HTMLInputElement>(
         '#avenue-ui-component-search',
      )
      const rows = document.querySelectorAll<HTMLTableRowElement>(
         '.avenue-component-row',
      )

      expect(search).not.toBeNull()

      if (!search) {
         return
      }

      search.value = 'card'
      search.dispatchEvent(new Event('input'))

      expect(rows[0]?.style.display).toBe('none')
      expect(rows[1]?.style.display).toBe('')
   })

   it('reports custom-element and shadow-style runtime health', async () => {
      document.body.innerHTML = `
         <table id="avenue-ui-components-table">
            <tbody>
               <tr
                  class="avenue-component-row"
                  data-tag="${testTag}"
                  data-discovered="1"
                  data-registered="1"
                  data-enqueued="1"
                  data-has-error="0"
                  data-requested-mode="block"
               >
                  <td class="avenue-cell-discovered"></td>
                  <td class="avenue-cell-registered"></td>
                  <td class="avenue-cell-enqueued"></td>
                  <td class="avenue-cell-js-defined"></td>
                  <td class="avenue-cell-css"></td>
                  <td class="avenue-cell-mode"></td>
                  <td class="avenue-cell-summary"></td>
               </tr>
            </tbody>
         </table>
      `

      await initializeAdminDiagnostics()

      expect(text('.avenue-cell-discovered')).toBe('✓')
      expect(text('.avenue-cell-registered')).toBe('✓')
      expect(text('.avenue-cell-enqueued')).toBe('✓')
      expect(text('.avenue-cell-js-defined')).toBe('✓')
      expect(text('.avenue-cell-css')).toBe('✓')
      expect(text('.avenue-cell-mode')).toBe('Shadow DOM')
      expect(text('.avenue-cell-summary')).toBe('Healthy')
   })

   it('binds copy-report behavior on the Diagnostics view', async () => {
      document.body.innerHTML = `
         <button id="avenue-ui-copy-report" type="button">
            Copy
         </button>
         <span id="avenue-ui-copy-status"></span>
         <pre id="avenue-ui-report">{"healthy":true}</pre>
      `

      const writeText = vi
         .spyOn(navigator.clipboard, 'writeText')
         .mockResolvedValue()

      await initializeAdminDiagnostics()

      document
         .querySelector<HTMLButtonElement>(
            '#avenue-ui-copy-report',
         )
         ?.click()

      await vi.waitFor(() => {
         expect(
            text('#avenue-ui-copy-status'),
         ).toBe('Copied')
      })

      expect(writeText).toHaveBeenCalledWith(
         '{"healthy":true}',
      )
   })
})

/**
 * Read normalized text from a test element.
 *
 * @param selector Element selector.
 * @returns Element text content.
 */
function text(selector: string): string {
   return document.querySelector(selector)
      ?.textContent
      ?.trim() ?? ''
}
