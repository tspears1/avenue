export class AveInvalidEvent extends Event {
   constructor() {
      super('ave-invalid', { bubbles: true, cancelable: false, composed: true });
   }
}

declare global {
   interface GlobalEventHandlersEventMap {
      'ave-invalid': AveInvalidEvent;
   }
}