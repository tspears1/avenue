// Lit ===============================================================
import { nothing, unsafeCSS } from 'lit'
import { html, literal } from 'lit/static-html.js'
import { customElement, property } from 'lit/decorators.js'
import { when } from 'lit/directives/when.js'
import { ifDefined } from 'lit/directives/if-defined.js'

// Avenue ============================================================
import AvenueElement from '../../internal/avenue-element'

// Component =========================================================
import rawStyles from './button.styles.css?inline'

/**
 * @component ave-button
 * @since 0.0.1
 *
 * @slot prefix - Used to prepend a presentational icon or similar element to the button.
 * @slot suffix - Used to append a presentational icon or similar element to the button.
 *
 * @property {string} label - The text label to display on the button.
 * @property {string} href - The URL to link to when the button is clicked.
 * @property {string} variant - The variant to apply to the button.
 * @property {string} icon - The icon to display on the button.
 *
 * @csspart root - The root element of the button.
 * @csspart prefix - The prefix slot of the button.
 * @csspart text - The text label of the button.
 * @csspart icon - The icon of the button.
 * @csspart suffix - The suffix slot of the button.
 */

@customElement('ave-button')
export class Button extends AvenueElement {
   static css = [unsafeCSS(rawStyles)]

   @property() label: string = ''

   @property({ reflect: true }) href?: string

   @property() variant: string = 'primary'

   @property() icon?: string

   private isLink() {
      return this.href ? true : false
   }

   render() {
      const isLink = this.isLink()
      const tag = isLink ? literal`a` : literal`button`

      return html`
         <${tag}
            part="root"
            variant=${this.variant}
            href=${ifDefined(isLink ? this.href : null)}
         >
            <slot name="prefix" part="prefix"></slot>

            <div class="button__text" part="text">${this.label}</div>

            ${when(
               this.icon,
               () => html`
                  <div class="button__icon" part="icon">
                        <svg>
                           <use href=${`#icon-${this.icon}`}></use>
                        </svg>
                  </div>
               `,
               () => nothing
            )}

            <slot name="suffix" part="suffix"></slot>

         </${tag}>
      `
   }
}
