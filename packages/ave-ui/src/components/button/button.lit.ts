// Lit ===============================================================
import { nothing, unsafeCSS } from 'lit'
import { html, literal } from 'lit/static-html.js'
import { customElement, property } from 'lit/decorators.js'
import { when } from 'lit/directives/when.js'
import { ifDefined } from 'lit/directives/if-defined.js'
import { classMap } from 'lit/directives/class-map.js';

// Avenue ============================================================
import AvenueElement from '../../internal/avenue-element'
import { HasSlotController } from '../../internal/slot.js';

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

   private readonly hasSlotController = new HasSlotController(this, 'prefix', 'suffix');

   @property() label: string = ''

   @property({ reflect: true }) href?: string

   /** Tells the browser where to open the link. Only used when `href` is present. */
   @property() target: '_blank' | '_parent' | '_self' | '_top';

   @property({ reflect: true }) variant: string = 'primary'

   @property() icon?: string

   /**
   * Only required for SSR. Set to `true` if you're slotting in a `prefix` element so the server-rendered markup
   * includes the prefix slot before the component hydrates on the client.
   */
   @property({ attribute: 'with-prefix', type: Boolean }) withPrefix = false;

   /**
    * Only required for SSR. Set to `true` if you're slotting in a `suffix` element so the server-rendered markup
    * includes the suffix slot before the component hydrates on the client.
    */
   @property({ attribute: 'with-suffix', type: Boolean }) withSuffix = false;

   private isLink() {
      return this.href ? true : false
   }

   render() {
      const isLink = this.isLink()
      const tag = isLink ? literal`a` : literal`button`

      return html`
         <${tag}
            class=${classMap({
               'has-prefix': this.hasUpdated ? this.hasSlotController.test('prefix') : this.withPrefix,
               'has-suffix': this.hasUpdated ? this.hasSlotController.test('suffix') : this.withSuffix,
            })}
            part="root"
            target=${ifDefined(isLink ? this.target : undefined)}
            href=${ifDefined(isLink ? this.href : null)}
            aria-label=${false}
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
