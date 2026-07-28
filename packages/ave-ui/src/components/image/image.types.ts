/**
 * Image Component Types
 * Shared between TypeScript and PHP
 */

export interface ImageProps {
   src?: string
   alt?: string
   srcset?: string
   sizes?: string
   height?: string
   width?: string
   sources?: ImageSource[]
   objectFit?: string
   objectPosition?: string
}

export interface ImageACFField {
   ID?: number
   id?: number
   url?: string
   alt?: string
   width?: number | string
   height?: number | string
   sizes?: Record<string, string>
}

export interface ImageSource {
   src: string
   type: string
   media: string
   sizes: string
}
