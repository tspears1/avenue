// Storybook ============================================================
import type { Meta, StoryObj } from '@storybook/web-components-vite'

// Component ===========================================================
import type { CardSectionProps } from './card-section.types.ts'
import './card-section.lit.ts'
import '../card/card.lit.ts'
import '../section/section.lit.ts'

const meta = {
    title: 'Pattern/Card Section',
    tags: ['autodocs'],
    render: (args) => {
        const component = document.createElement('ave-card-section')
        Object.assign(component, args)
        return component
    },
    argTypes: {
        section: {
            description: 'Section configuration, including its appearance, header, and footer.',
        },
        cards: {
            description: 'The Card configurations rendered within the Section.',
        },
    },
    args: {
        section: {
            appearance: 'light',
            header: {
                heading: 'Featured Stories',
                intro: 'Explore the latest stories from Avenue.',
            },
            footer: {
                buttons: [
                    {
                        label: 'View All Stories',
                        href: '#',
                    },
                ],
            },
        },
        cards: [
            {
                title: 'A New Hope',
                text: 'It is a period of civil war. Rebel spaceships, striking from a hidden base, have won their first victory against the evil Galactic Empire.',
                link: {
                    label: 'Save the Galaxy',
                    href: '#first-card',
                },
            },
            {
                title: 'The Empire Strikes Back',
                text: 'The Galactic Empire continues its reign of terror, and the Rebel Alliance faces new challenges.',
                link: {
                    label: 'Join the Fight',
                    href: '#second-card',
                },
            },
            {
                title: 'Return of the Jedi',
                text: 'The final battle between the Rebel Alliance and the Galactic Empire unfolds, bringing hope to the galaxy.',
                link: {
                    label: 'Celebrate Victory',
                    href: '#third-card',
                },
            }
        ],
    },
} satisfies Meta<CardSectionProps>

export default meta
type Story = StoryObj<CardSectionProps>

export const Default: Story = {
    args: {},
}
