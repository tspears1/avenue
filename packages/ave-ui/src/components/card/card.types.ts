/**
 * Card Component Types
 * Shared between TypeScript and PHP
 */

import type { ImageProps } from "../image/image.types";
import type { ButtonProps } from "../button/button.types";

export interface CardProps {
   title?: string | object
   text?: string | object
   link?: ButtonProps
   image?: ImageProps
   tag?: string
}

export interface CardACFField {
   title?: string
}
