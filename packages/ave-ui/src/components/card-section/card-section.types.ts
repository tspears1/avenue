/**
 * CardSection Component Types
 * Shared between TypeScript and PHP
 */

import type { CardProps } from '../card/card.types'
import type { SectionProps } from '../section/section.types'

export interface CardSectionProps {
    section: SectionProps
    cards: CardProps[]
}

export interface CardSectionACFField {
    section: SectionProps
    cards: CardProps[]
}
