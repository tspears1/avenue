// Storybook ============================================================
import type { Meta, StoryObj } from '@storybook/web-components-vite'

// Component ===========================================================
import type { TestThingProps } from './test-thing.types.ts'
import './test-thing.lit.ts'

const meta = {
    title: 'Organisms/Test Thing',
    tags: ['autodocs'],
    render: (args) => {
        const component = document.createElement('ave-test-thing')
        Object.assign(component, args)
        return component
    },
    argTypes: {
        label: {
            description: 'Fallback text rendered when no slot content is provided.',
        },
    },
    args: {
        label: 'Test Thing',
    },
} satisfies Meta<TestThingProps>

export default meta
type Story = StoryObj<TestThingProps>

export const Default: Story = {
    args: {
        label: 'Test Thing',
    },
}
