// Lit ===============================================================
import { unsafeCSS } from 'lit'
import { html } from 'lit/static-html.js'
import { customElement, property } from 'lit/decorators.js'
import { map } from 'lit/directives/map.js'
import { ifDefined } from 'lit/directives/if-defined.js'

// Avenue ============================================================
import AvenueElement from '../../internal/avenue-element'

// Component =========================================================
import rawStyles from './card-section.styles.css?inline'
import '../card/card.lit.ts'
import '../section/section.lit.ts'

// Types =============================================================
import type { CardProps } from '../card/card.types'
import type { SectionProps } from '../section/section.types'

/**
 * @component ave-card-section
 * @since 0.0.1
 *
 * @property {SectionProps} section - The section props
 * @property {CardProps[]} cards - The cards to display
 *
 * @csspart root - The root wrapper element.
 * @csspart container - The container wrapping all the cards.
 * @csspart card - Each individual card within the container.
 *
 */

@customElement('ave-card-section')
export class CardSection extends AvenueElement {
    static css = [unsafeCSS(rawStyles)]

    @property({ attribute: false })
    section: SectionProps

    @property({ attribute: false })
    cards: CardProps[]

    render() {
        return html`
            <ave-section
                class=${ifDefined(this.section?.additionalClasses)}
                elementId=${ifDefined(this.section?.elementId)}
                appearance=${ifDefined(this.section?.appearance)}
                .header=${ifDefined(this.section?.header)}
                .footer=${ifDefined(this.section?.footer)}
            >
                ${map(this.cards, card => html`
                    <ave-card
                        title=${ifDefined(card.title)}
                        text=${ifDefined(card.text)}
                        .link=${ifDefined(card.link)}
                        .image=${ifDefined(card.image)}
                    ></ave-card>
                `)}
            </ave-section>
        `;
    }
}
