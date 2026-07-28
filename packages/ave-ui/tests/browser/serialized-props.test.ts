import {
   afterEach,
   describe,
   expect,
   it,
   vi,
} from 'vitest'
import {
   html,
   LitElement,
} from 'lit'

import { SerializedPropsMixin } from '../../src/internal/mixins/serialized-props.mixin'

interface TestLink {
   href: string
   label?: string
}

class SerializedPropsTestElement extends SerializedPropsMixin(
   LitElement,
) {
   static properties = {
      variant: {
         type: String,
      },
      link: {
         attribute: false,
      },
   }

   declare variant: string
   declare link?: TestLink

   constructor() {
      super()
      this.variant = 'primary'
   }

   protected render() {
      return html`
         <span id="variant">${this.variant}</span>
         <span id="href">${this.link?.href ?? ''}</span>
      `
   }
}

const tag = 'ave-serialized-props-test'

if (!customElements.get(tag)) {
   customElements.define(
      tag,
      SerializedPropsTestElement,
   )
}

async function createElement(
   serializedProps?: string,
): Promise<SerializedPropsTestElement> {
   const element = document.createElement(
      tag,
   ) as SerializedPropsTestElement

   if (serializedProps !== undefined) {
      element.setAttribute(
         'data-props',
         serializedProps,
      )
   }

   document.body.append(element)
   await element.updateComplete

   return element
}

afterEach(() => {
   document.body.replaceChildren()
})

describe('SerializedPropsMixin', () => {
   it('hydrates declared attribute:false properties reactively', async () => {
      const element = await createElement(
         JSON.stringify({
            link: {
               href: '/about/',
               label: 'About',
            },
         }),
      )

      expect(element.link).toEqual({
         href: '/about/',
         label: 'About',
      })
      expect(
         element.shadowRoot?.querySelector('#href')
            ?.textContent,
      ).toBe('/about/')
   })

   it('does not overwrite attribute-backed properties', async () => {
      const element = document.createElement(
         tag,
      ) as SerializedPropsTestElement

      element.setAttribute('variant', 'secondary')
      element.setAttribute(
         'data-props',
         JSON.stringify({
            variant: 'primary',
            link: {
               href: '/about/',
            },
         }),
      )
      document.body.append(element)
      await element.updateComplete

      expect(element.variant).toBe('secondary')
      expect(element.link?.href).toBe('/about/')
   })

   it('ignores unknown and reserved property names', async () => {
      const element = await createElement(
         JSON.stringify({
            unknown: 'value',
            serializedProps: 'replacement',
         }),
      )

      expect(
         (element as unknown as Record<string, unknown>)
            .unknown,
      ).toBeUndefined()
      expect(element.serializedProps).not.toBe(
         'replacement',
      )
   })

   it('reports malformed and non-object payloads', async () => {
      for (const payload of [
         '{invalid',
         '[]',
         'null',
      ]) {
         const element = document.createElement(
            tag,
         ) as SerializedPropsTestElement
         const listener = vi.fn()

         element.addEventListener(
            'avenue-invalid-props',
            listener,
         )
         element.setAttribute('data-props', payload)
         document.body.append(element)
         await element.updateComplete

         expect(listener).toHaveBeenCalledOnce()
         element.remove()
      }
   })

   it('rehydrates when data-props changes', async () => {
      const element = await createElement(
         JSON.stringify({
            link: {
               href: '/first/',
            },
         }),
      )

      element.setAttribute(
         'data-props',
         JSON.stringify({
            link: {
               href: '/second/',
            },
         }),
      )
      await element.updateComplete

      expect(element.link?.href).toBe('/second/')
      expect(
         element.shadowRoot?.querySelector('#href')
            ?.textContent,
      ).toBe('/second/')
   })
})
