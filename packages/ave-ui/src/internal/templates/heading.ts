import { html } from 'lit/static-html.js'
import { when } from 'lit/directives/when.js'
import { ifDefined } from 'lit/directives/if-defined.js'

/**
 * Template: Heading
 *
 * @property {string} label - The text label to display in the heading.
 * @property {string} tag - The heading tag to use.
 * @property {string} link - The URL to link to when the heading is clicked.
 * @property {string} target - The target to link to when the heading is clicked.
 */
const Heading = (label: string, tag = 'h1', link = null, target = null ) => {
   return html`
      <${tag} part="heading">
         ${when(
            link,
            () => html`
               <a href="${ifDefined(link)}" target="${ifDefined(target)}" part="heading-link">
                  ${label}
               </a>
            `,
            () => html`
               <span part="heading-text">${label}</span>
            `
         )}
      </${tag}>
   `;
};

export default Heading;