/**
 * Button Component Types
 * Shared between TypeScript and PHP
 */

export interface ButtonProps {
   label: string
   variant?: 'primary' | 'secondary' | 'outline'
   icon?: string
   href?: string
   target?: '_self' | '_blank'
   onClick?: () => void
}

export interface ButtonACFField {
   label: string
   href?: string
   target?: string
   variant?: string
   icon?: string
}
