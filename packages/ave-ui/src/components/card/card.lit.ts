// Lit ===============================================================
import { unsafeCSS } from 'lit'
import { html } from 'lit/static-html.js'
import { customElement, property } from 'lit/decorators.js'
import { when } from 'lit/directives/when.js'
import { ifDefined } from 'lit/directives/if-defined.js'

// Avenue ============================================================
import AvenueElement from '../../internal/avenue-element'

// Component =========================================================
import rawStyles from './card.styles.css?inline'
import type { ButtonProps } from '../button/button.types'
import type { ImageProps } from '../image/image.types'
import '../button/button.lit.ts'
import '../image/image.lit.ts'

import { Heading } from '../../internal/templates/heading'

/**
 * @component ave-card
 * @since 0.0.1
 *
 * @dependency ave-button
 * @dependency ave-image
 *
 * @slot before-title - Used to prepend content to the card.
 * @slot after-title - Used to prepend content to the card.
 * @slot before-actions - Used to append content to the card.
 * @slot after-actions - Used to append content to the card.
 *
 * @property {string} title - The title of the card.
 * @property {string | object} text - The text content of the card.
 * @property {ButtonProps} link - The link to be displayed on the card.
 * @property {ImageProps} image - The image to be displayed on the card.
 */

@customElement('ave-card')
export class Card extends AvenueElement {
   static css = [unsafeCSS(rawStyles)]

   @property() title: string = ''

   @property() text: string | object = ''

   @property({ attribute: false }) link: ButtonProps = { href: '', label: '', target: '_self' }

   @property({ attribute: false }) image: ImageProps = {}

   /**
    * Returns whether the card has content to display.
    */
   private hasContent(): boolean {
      return !!this.title || !!this.text || !!this.link
   }

   render() {
      return html`
         <article part="root">
            ${when(
               this.hasContent(),
               () => html`
                  <div part="content">
                     <slot name="before-title"></slot>
                     ${when(
                        this.title,
                        () => Heading(this.title, 'h2')
                     )}
                     <slot name="after-title"></slot>
                     ${when(
                        this.text,
                        () => html`
                           <p part="text">${this.text}</p>
                        `
                     )}
                     <slot name="before-actions"></slot>
                     ${when(
                        this.link?.href,
                        () => html`
                           <ave-button
                              variant=${ifDefined(this.link?.variant)}
                              href=${ifDefined(this.link?.href)}
                              target=${ifDefined(this.link?.target)}
                              label=${ifDefined(this.link?.label)}
                           ></ave-button>
                        `
                     )}
                     <slot name="after-actions"></slot>
               </div>
               `
            )}
            ${when(
               this.image?.src,
               () => html`
                  <ave-image
                     src=${ifDefined(this.image?.src)}
                     alt=${ifDefined(this.image?.alt)}
                     srcset=${ifDefined(this.image?.srcset)}
                     sizes=${ifDefined(this.image?.sizes)}
                     height=${ifDefined(this.image?.height)}
                     width=${ifDefined(this.image?.width)}
                     .sources=${this.image?.sources ?? []}
                     object-fit=${ifDefined(this.image?.objectFit)}
                     object-position=${ifDefined(this.image?.objectPosition)}
                  ></ave-image>
               `
            )}
         </article>
      `
   }
}
