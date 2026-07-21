// Storybook ============================================================
import type { Meta, StoryObj } from '@storybook/web-components-vite'

// Component ===========================================================
import type { CardProps } from './card.types.ts'
import './card.lit.ts'

const meta = {
   title: 'Molecules/Card',
   tags: ['autodocs'],
   render: (args) => {
      const component = document.createElement('ave-card') as any
      // Reconstruct nested objects from flattened args
      const props: any = {
         title: args.title,
         text: args.text,
      }

      // Build image object if any image properties are set
      if (args['image.src']) {
         props.image = {
            src: args['image.src'],
            alt: args['image.alt'],
            width: args['image.width'],
            height: args['image.height'],
         }
      }

      // Build link object if any link properties are set
      if (args['link.label'] && args['link.href']) {
         props.link = {
            label: args['link.label'],
            href: args['link.href'],
            variant: args['link.variant'],
            icon: args['link.icon'],
         }
      }

      Object.assign(component, props)
      return component
   },
   argTypes: {
      title: {
         description: 'Fallback text rendered when no slot content is provided.',
      },
   },
   args: {
      title: 'Card',
   },
} satisfies Meta<CardProps & Record<string, any>>

export default meta
type Story = StoryObj<CardProps & Record<string, any>>

export const Default: Story = {
   args: {
      title: 'Event Horizon Inbox',
      text: 'Messages drift in from the outer rim, half-forgotten and slightly radioactive. Filter what you can, archive what you must, and let the rest spiral gracefully into the dark. ',
      'link.href': '#',
      'link.label': 'View Inbox',
      'link.theme': 'outline',
      'image.src':
         'https://wallpapercat.com/w/full/a/4/4/2132585-1920x1080-desktop-full-hd-wormhole-interstellar-background-photo.jpg',
      'image.alt': 'a wormhole in interstellar space',
   },
}