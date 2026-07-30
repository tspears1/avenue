// Lit ===============================================================
import { unsafeCSS } from 'lit'
import { html } from 'lit/static-html.js'
import { customElement, property } from 'lit/decorators.js'

// Avenue ============================================================
import AvenueElement from '../../internal/avenue-element'

// Component =========================================================
import rawStyles from './section.styles.css?inline'

/**
 * @component ave-section
 * @since 0.0.1
 *
 * @slot - Optional slotted content that replaces the label.
 *
 * @property {string} label - Fallback content shown when no slot content is provided.
 *
 * @csspart root - The root wrapper element.
 */

@customElement('ave-section')
export class Section extends AvenueElement {
    static css = [unsafeCSS(rawStyles)]

    @property() label: string = ''

    render() {
        return html`
            <div part="root">
            <slot>${this.label}</slot>
            </div>
        `
    }
}
