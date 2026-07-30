// Lit ===============================================================
import { unsafeCSS } from 'lit'
import { html } from 'lit/static-html.js'
import { customElement, property } from 'lit/decorators.js'
import { ifDefined } from 'lit/directives/if-defined.js';
import { map } from 'lit/directives/map.js';
import { when } from 'lit/directives/when.js'

// Avenue ============================================================
import AvenueElement from '../../internal/avenue-element'
import { HasSlotController } from '../../internal/slot.js';
import { Heading } from '../../internal/templates/heading'

// Component =========================================================
import rawStyles from './section.styles.css?inline'

// Types ==============================================================
import type { ButtonProps } from "../button/button.types"
import type { SectionHeaderProps, SectionFooterProps } from './section.types'

/**
 * @component ave-section
 * @since 0.0.1
 *
 * @slot - Default slot for section content
 *
 * @property {string} elementId - Optional ID attribute for the section element
 * @property {string} appearance - Appearance variant (light or dark)
 * @property {SectionHeaderProps} header - Header content with heading, intro, and buttons
 * @property {SectionFooterProps} footer - Footer content with outro and buttons
 *
 * @csspart root - The root section element
 * @csspart header - The header container
 * @csspart heading - The heading element
 * @csspart intro - The intro text element
 * @csspart header-actions - The header button group container
 * @csspart content - The content container
 * @csspart footer - The footer container
 * @csspart footer-heading - The footer heading element
 * @csspart outro - The outro text element
 * @csspart footer-actions - The footer button group container
 */

@customElement('ave-section')
export class Section extends AvenueElement {
    static css = [unsafeCSS(rawStyles)]

    private readonly hasSlotController = new HasSlotController(this, '[default]');

    @property() elementId?: string

    @property({ reflect: true }) appearance?: 'light' | 'dark'

    @property({ attribute: false })
    header?: SectionHeaderProps

    @property({ attribute: false })
    footer?: SectionFooterProps

    /**
     * Returns whether the section has a header.
     */
    private hasHeader(): boolean {
        return !!( this.header?.heading || this.header?.intro || this.header?.buttons?.length )
    }

    /**
     * Returns whether the section has a footer.
     */
    private hasFooter(): boolean {
        return !!(this.footer?.outro || this.footer?.buttons?.length)
    }

    /**
     * Builds a button group for the section footer.
     */
    private buildButtonGroup(buttons: ButtonProps[], part: string = 'buttons') {
        return html`
            <div class="use--cluster" part=${ifDefined(part)}>
                ${map( buttons, (button) => html`
                    <ave-button
                        label=${button.label}
                        variant=${ifDefined(button.variant)}
                        href=${ifDefined(button.href)}
                        icon=${ifDefined(button.icon)}
                        target=${ifDefined(button.target)}
                    ></ave-button>
                `)}
            </div>
        `
    }

    render() {
        const hasContent = this.hasSlotController.test('[default]')

        return html`
            <section
                id=${ifDefined(this.elementId)}
                part="root"
            >
                ${when(this.hasHeader(), () => html`
                    <header part="header">
                        ${when(
                            this.header?.heading,
                                () => Heading(this.header?.heading, 'h2', null, null, 1)
                        )}
                        ${when(
                            this.header?.intro,
                            () => html`
                                <p part="intro">
                                    ${this.header?.intro}
                                </p>
                            `
                        )}
                        ${when(this.header?.buttons?.length, () =>
                            this.buildButtonGroup(this.header!.buttons!, 'header-actions')
                        )}
                    </header>
                `)}

                ${when(hasContent, () => html`
                    <div part="content">
                        <slot></slot>
                    </div>
                `)}

                ${when(this.hasFooter(), () => html`
                    <footer part="footer">
                        ${when(
                            this.footer?.heading,
                            () => Heading(this.footer?.heading, 'h3', null, null, 1, 'footer-heading')
                        )}
                        ${when(
                            this.footer?.outro,
                            () => html`
                                <p part="outro">
                                    ${this.footer?.outro}
                                </p>
                            `
                        )}
                        ${when(this.footer?.buttons?.length, () =>
                            this.buildButtonGroup(this.footer!.buttons!, 'footer-actions')
                        )}
                    </footer>
                `)}
            </section>
        `
    }
}
