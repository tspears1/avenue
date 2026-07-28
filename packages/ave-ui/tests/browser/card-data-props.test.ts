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
   it('hydrates structured props and renders its Button and Image', async () => {
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
            image: {
               src: '/campus.jpg',
               alt: 'Boston University campus',
               width: '1200',
               height: '675',
               objectFit: 'contain',
               objectPosition: 'top',
               sources: [
                  {
                     src: '/campus.webp',
                     type: 'image/webp',
                     media: '(min-width: 60rem)',
                     sizes: '50vw',
                  },
               ],
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
      expect(card.image).toEqual({
         src: '/campus.jpg',
         alt: 'Boston University campus',
         width: '1200',
         height: '675',
         objectFit: 'contain',
         objectPosition: 'top',
         sources: [
            {
               src: '/campus.webp',
               type: 'image/webp',
               media: '(min-width: 60rem)',
               sizes: '50vw',
            },
         ],
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

      const image = card.shadowRoot?.querySelector(
         'ave-image',
      )

      expect(image?.getAttribute('src')).toBe(
         '/campus.jpg',
      )
      expect(image?.getAttribute('alt')).toBe(
         'Boston University campus',
      )
      expect(image?.getAttribute('width')).toBe('1200')
      expect(image?.getAttribute('height')).toBe('675')
      expect(image?.getAttribute('object-fit')).toBe(
         'contain',
      )
      expect(image?.getAttribute('object-position')).toBe(
         'top',
      )
      expect(image?.sources).toEqual([
         {
            src: '/campus.webp',
            type: 'image/webp',
            media: '(min-width: 60rem)',
            sizes: '50vw',
         },
      ])

      await image?.updateComplete

      const source = image?.shadowRoot?.querySelector(
         'source',
      )

      expect(source?.getAttribute('src')).toBe(
         '/campus.webp',
      )
      expect(source?.getAttribute('type')).toBe(
         'image/webp',
      )
   })
})
