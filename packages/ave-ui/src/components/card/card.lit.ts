// Lit ===============================================================
import { unsafeCSS } from 'lit'
import { html } from 'lit/static-html.js'
import { customElement, property } from 'lit/decorators.js'

// Avenue ============================================================
import AvenueElement from '../../internal/avenue-element'

// Component =========================================================
import rawStyles from './card.styles.css?inline'

/**
 * @component ave-card
 * @since 0.0.1
 *
 * @slot - Optional slotted content that replaces the title.
 *
 * @property {string} title - Fallback content shown when no slot content is provided.
 *
 * @csspart root - The root wrapper element.
 */

@customElement('ave-card')
export class Card extends AvenueElement {
   static css = [unsafeCSS(rawStyles)]

   @property() title: string = ''

   render() {
      return html`
         <div part="root">
            <slot>${this.title}</slot>
         </div>
      `
   }
}
