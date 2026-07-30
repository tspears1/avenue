// Storybook ============================================================
import type { Meta, StoryObj } from '@storybook/web-components-vite'

// Component ===========================================================
import type { SectionProps } from './section.types.ts'
import './section.lit.ts'

const meta = {
    title: 'Organisms/Section',
    tags: ['autodocs'],
    render: (args) => {
        const component = document.createElement('ave-section')
        Object.assign(component, args)
        return component
    },
    argTypes: {
        label: {
            description: 'Fallback text rendered when no slot content is provided.',
        },
    },
    args: {
        label: 'Section',
    },
} satisfies Meta<SectionProps>

export default meta
type Story = StoryObj<SectionProps>

export const Default: Story = {
    args: {
        label: 'Section',
    },
}
