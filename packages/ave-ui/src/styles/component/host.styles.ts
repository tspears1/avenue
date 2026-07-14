import { css } from 'lit';

export default css`
  @layer reset, utilities, component, break-glass;

  @layer reset {
    :host {
      box-sizing: border-box;
    }

    :host *,
    :host *::before,
    :host *::after {
      box-sizing: inherit;
    }

    [hidden] {
      display: none !important;
    }
  }
`;