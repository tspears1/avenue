/**
 * Section Component Types
 * Shared between TypeScript and PHP
 */

import type { ButtonProps } from "../button/button.types"
export interface SectionHeaderProps {
    heading?: string
    intro?: string
    buttons?: ButtonProps[]
}

export interface SectionFooterProps {
    heading?: string
    outro?: string
    buttons?: ButtonProps[]
}

export interface SectionProps {
    appearance?: 'light' | 'dark'
    elementId?: string
    additionalClasses?: string
    header?: SectionHeaderProps
    footer?: SectionFooterProps
}

export interface SectionACFField {
    appearance?: 'light' | 'dark'
    elementId?: string
    additionalClasses?: string
    header?: SectionHeaderProps
    footer?: SectionFooterProps
}

