// Storybook ============================================================
import type { Meta, StoryObj } from '@storybook/web-components-vite'

// Component ===========================================================
import type { ImageProps } from './image.types.ts'
import './image.lit.ts'

const meta = {
   title: 'Atoms/Image',
   tags: ['autodocs'],
   render: (args) => {
      const component = document.createElement('ave-image')
      Object.assign(component, args)
      return component
   },
} satisfies Meta<ImageProps>

export default meta
type Story = StoryObj<ImageProps>

export const Default: Story = {
   args: {},
}
