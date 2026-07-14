import "ave-css/styles/core";

import type { Preview } from "@storybook/web-components-vite";

const preview: Preview = {
   parameters: {
      controls: {
         matchers: {
            color: /(background|color)$/i,
            date: /Date$/i,
         },
      },

      a11y: {
         // 'todo' - show a11y violations in the test UI only
         // 'error' - fail CI on a11y violations
         // 'off' - skip a11y checks entirely
         test: 'todo',
      },

      // Control sidebar story ordering
      options: {
         storySort: {
            order: ['Atoms', 'Molecules', 'Organisms', '*'],
         },
      },
   },
}

export default preview;
