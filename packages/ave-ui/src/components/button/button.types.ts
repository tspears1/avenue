/**
 * Button Component Types
 * Shared between TypeScript and PHP
 */

export interface ButtonProps {
   label: string
   variant?: 'primary' | 'secondary' | 'outline'
   href?: string
   target?: '_blank' | '_parent' | '_self' | '_top';
   icon?: string
}

export interface ButtonACFField {
   label: string
   variant?: 'primary' | 'secondary' | 'outline'
   href?: string
   target?: '_blank' | '_parent' | '_self' | '_top';
   icon?: string
}
