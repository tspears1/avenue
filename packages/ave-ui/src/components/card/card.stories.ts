// Storybook ============================================================
import type { Meta, StoryObj } from '@storybook/web-components-vite'

// Component ===========================================================
import type { CardProps } from './card.types.ts'
import './card.lit.ts'

const meta = {
   title: 'Molecules/Card',
   tags: ['autodocs'],
   render: (args) => {
      const component = document.createElement('ave-card')
      Object.assign(component, args)
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
} satisfies Meta<CardProps>

export default meta
type Story = StoryObj<CardProps>

export const Default: Story = {
   args: {
      title: 'Card',
   },
}
