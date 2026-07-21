import type { PropertyValues, ReactiveElement } from 'lit';
import { property } from 'lit/decorators.js';

export type Constructor<T = object> = abstract new (
   ...args: any[]
) => T;

type ReactiveElementConstructor =
   Constructor<ReactiveElement>;

type SerializedProps = Record<string, unknown>;

export interface SerializedPropsHost {
   serializedProps?: string;

   hydrateSerializedProps(): void;
}

export type SerializedPropsConstructor<
   TBase extends ReactiveElementConstructor,
> = TBase & Constructor<SerializedPropsHost>;

export function SerializedPropsMixin<
   TBase extends ReactiveElementConstructor,
>(
   Base: TBase,
): SerializedPropsConstructor<TBase> {
   abstract class SerializedPropsElement
      extends Base
      implements SerializedPropsHost {
      @property({
         attribute: 'data-props',
         type: String,
      })
      serializedProps?: string;

      protected override willUpdate(
         changedProperties: PropertyValues<this>,
      ): void {
         if (changedProperties.has('serializedProps')) {
            this.hydrateSerializedProps();
         }

         super.willUpdate(changedProperties);
      }

      public hydrateSerializedProps(): void {
         const props = this.parseSerializedProps();

         if (!props) {
            return;
         }

         for (const [name, value] of Object.entries(props)) {
            if (!this.canHydrateProperty(name)) {
               continue;
            }

            this.applySerializedProperty(name, value);
         }
      }

      protected parseSerializedProps():
         | SerializedProps
         | undefined {
         if (!this.serializedProps) {
            return undefined;
         }

         try {
            const value: unknown = JSON.parse(
               this.serializedProps,
            );

            if (!this.isSerializedPropsRecord(value)) {
               this.reportInvalidSerializedProps(
                  new TypeError(
                     'data-props must contain a JSON object.',
                  ),
               );

               return undefined;
            }

            return value;
         } catch (error) {
            this.reportInvalidSerializedProps(error);

            return undefined;
         }
      }

      protected canHydrateProperty(name: string): boolean {
         if (name === 'serializedProps') {
            return false;
         }

         const constructor = this
            .constructor as typeof ReactiveElement;

         const declaration =
            constructor.elementProperties.get(name);

         if (!declaration) {
            return false;
         }

         /*
          * Only hydrate properties explicitly configured not to
          * use their own HTML attribute.
          */
         return declaration.attribute === false;
      }

      protected applySerializedProperty(
         name: string,
         value: unknown,
      ): void {
         const element = this as unknown as Record<
            string,
            unknown
         >;

         element[name] = value;
      }

      protected isSerializedPropsRecord(
         value: unknown,
      ): value is SerializedProps {
         return (
            typeof value === 'object' &&
            value !== null &&
            !Array.isArray(value)
         );
      }

      protected reportInvalidSerializedProps(
         error: unknown,
      ): void {
         this.dispatchEvent(
            new CustomEvent('avenue-invalid-props', {
               bubbles: true,
               composed: true,
               detail: {
                  attribute: 'data-props',
                  value: this.serializedProps,
                  error,
               },
            }),
         );
      }
   }

   return SerializedPropsElement as SerializedPropsConstructor<TBase>;
}