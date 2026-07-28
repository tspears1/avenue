// Lit ===============================================================
import { nothing, unsafeCSS } from 'lit'
import { html } from 'lit/static-html.js'
import { customElement, property } from 'lit/decorators.js'
import { when } from 'lit/directives/when.js'
import { ifDefined } from 'lit/directives/if-defined.js'

// Avenue ============================================================
import AvenueElement from '../../internal/avenue-element'

// Component =========================================================
import rawStyles from './image.styles.css?inline'
import type { ImageSource } from './image.types'

/**
 * @component ave-image
 * @since 0.0.1
 *
 * @slot sources - Optional slotted content that replaces the source elements.
 *
 * @property {string} src - The source URL of the image.
 * @property {string} alt - The alternative text for the image.
 * @property {string} srcset - The srcset attribute for responsive images.
 * @property {string} sizes - The sizes attribute for responsive images.
 * @property {string} height - The height of the image.
 * @property {string} width - The width of the image.
 * @property {ImageSource[]} sources - An array of source elements for the picture element.
 * @property {string} objectFit - The CSS object-fit property for the image.
 * @property {string} objectPosition - The CSS object-position property for the image.
 *
 * @csspart root - The root wrapper element.
 * @csspart picture - The picture element.
 * @csspart image - The image element itself.
 */

@customElement('ave-image')
export class Image extends AvenueElement {
   static css = [unsafeCSS(rawStyles)]

   @property() src: string = ''

   @property() alt: string = ''

   @property() srcset: string = ''

   @property() sizes: string = ''

   @property() height: string = ''

   @property() width: string = ''

   @property({ attribute: false }) sources: ImageSource[] = []

   @property({ reflect: true, attribute: 'object-fit' }) objectFit: string = 'cover'

   @property({ reflect: true, attribute: 'object-position' }) objectPosition: string = 'center'

   render() {
      return html`
         <div part="root">
            <picture part="picture">
               <slot name="sources">
                  ${when(
                     this.sources.length > 0,
                     () => this.sources.map(
                        (source) => html`
                           <source
                              src="${ifDefined(source.src)}"
                              media="${ifDefined(source.media)}"
                              sizes="${ifDefined(source.sizes)}"
                              type="${ifDefined(source.type)}"
                           />
                        `
                     ),
                     () => nothing
                  )}
               </slot>
               <img
                  part="image"
                  src="${ifDefined(this.src)}"
                  alt="${ifDefined(this.alt)}"
                  srcset="${ifDefined(this.srcset)}"
                  sizes="${ifDefined(this.sizes)}"
                  height="${ifDefined(this.height)}"
                  width="${ifDefined(this.width)}"
               />
            </picture>
         </div>
      `
   }
}
