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
        appearance: {
            control: 'select',
            options: [
                'light',
                'dark',
            ],
            description: 'Visual appearance of the section.',
        },
        header: {
            description: 'Header heading, introduction, and action buttons.',
        },
        footer: {
            description: 'Footer heading, closing text, and action buttons.',
        },
    },
    args: {
        appearance: 'light',
        header: {
            heading: 'Section heading',
            intro: 'Introductory content for this section.',
            buttons: [
                {
                    label: 'Primary action',
                    href: '#',
                },
            ],
        },
        footer: {
            outro: 'Closing content for this section.',
        },
    },
} satisfies Meta<SectionProps>

export default meta
type Story = StoryObj<SectionProps>

export const Default: Story = {
    args: {},
}
