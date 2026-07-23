import { html, literal } from 'lit/static-html.js'
import { when } from 'lit/directives/when.js'
import { ifDefined } from 'lit/directives/if-defined.js'

const tags: Record<string, unknown> = {
   h1: literal`h1`,
   h2: literal`h2`,
   h3: literal`h3`,
   h4: literal`h4`,
   h5: literal`h5`,
   h6: literal`h6`,
}

/**
 * Template: Heading
 *
 * @property {string} label - The text label to display in the heading.
 * @property {string} tag - The heading tag to use.
 * @property {string} link - The URL to link to when the heading is clicked.
 * @property {string} target - The target to link to when the heading is clicked.
 */
const Heading = (label: string, level = 'h1', link = null, target = null ) => {
   const tag = tags[level]
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

export { Heading };