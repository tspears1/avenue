import {
   afterEach,
   describe,
   expect,
   it,
} from 'vitest'

import {
   Card,
} from '../../src/components/card/card.lit'
import type {
   ReactiveElement,
} from 'lit'

afterEach(() => {
   document.body.replaceChildren()
})

describe('Card data-props transport', () => {
   it('hydrates the link property and renders its Button', async () => {
      const card = document.createElement(
         'ave-card',
      ) as Card

      expect(card).toBeInstanceOf(Card)
      expect(card.link).toEqual({
         href: '',
         label: '',
         target: '_self',
      })
      expect(
         (
            card.constructor as typeof ReactiveElement
         ).elementProperties.get('link')?.attribute,
      ).toBe(false)

      card.setAttribute('title', 'Programs')
      card.setAttribute(
         'data-props',
         JSON.stringify({
            link: {
               label: 'Explore programs',
               variant: 'secondary',
               href: '/programs/',
               target: '_blank',
            },
         }),
      )

      document.body.append(card)
      await card.updateComplete

      expect(card.title).toBe('Programs')
      expect(card.link).toEqual({
         label: 'Explore programs',
         variant: 'secondary',
         href: '/programs/',
         target: '_blank',
      })

      const button = card.shadowRoot?.querySelector(
         'ave-button',
      )

      expect(button?.getAttribute('label')).toBe(
         'Explore programs',
      )
      expect(button?.getAttribute('variant')).toBe(
         'secondary',
      )
      expect(button?.getAttribute('href')).toBe(
         '/programs/',
      )
      expect(button?.getAttribute('target')).toBe(
         '_blank',
      )
   })
})
