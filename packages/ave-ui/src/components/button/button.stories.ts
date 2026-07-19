// Storybook ============================================================
import type { Meta, StoryObj } from '@storybook/web-components-vite'
// import { fn } from 'storybook/test'

// Component ===========================================================
import type { ButtonProps } from './button.types.ts'
import './button.lit.ts'

const meta = {
   title: 'Atoms/Button',
   tags: ['autodocs'],
   render: (args) => {
      const button = document.createElement('ave-button')
      Object.assign(button, args)
      return button
   },
   argTypes: {
      label: {},
      href: {},
      variant: {
         description: 'Visual Style of the button.',
         control: 'radio',
         options: ['primary', 'secondary', 'outline'],
         table: {
            type: { summary: 'primary | secondary | outline' },
            defaultValue: { summary: 'primary' },
         },
      },
      icon: {},
   },
   args: {
      label: 'Buttons',
      href: '',
      variant: 'primary',
      icon: '',
   },
} satisfies Meta<ButtonProps>

export default meta
type Story = StoryObj<ButtonProps>

export const Primary: Story = {
   args: {
      variant: 'primary',
      label: 'Button',
   },
}

export const Secondary: Story = {
   args: {
      label: 'Button',
      variant: 'secondary',
   },
}

export const Outline: Story = {
   args: {
      label: 'Button',
      variant: 'outline',
   },
}
