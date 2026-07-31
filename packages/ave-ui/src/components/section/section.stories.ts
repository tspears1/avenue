// Storybook ============================================================
import type { Meta, StoryObj } from '@storybook/web-components-vite'
import { html } from 'lit'

// Component ===========================================================
import type { SectionProps } from './section.types.ts'
import './section.lit.ts'
import '../button/button.lit.ts'

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
    render: (args) => {
        return html`
            <ave-section .header=${args.header} .footer=${args.footer} appearance=${args.appearance}>
                <p>It is a period of civil war. Rebel spaceships, striking from a hidden base, have won their first victory against the evil Galactic Empire.</p>
                <p>During the battle, Rebel spies managed to steal secret plans to the Empire's ultimate weapon, the DEATH STAR, an armored space station with enough power to destroy an entire planet.</p>
                <p>Pursued by the Empire's sinister agents, Princess Leia races home aboard her starship, custodian of the stolen plans that can save her people and restore freedom to the galaxy....</p>
            </ave-section>
        `
    },
}
