# Avenue `data-props` Implementation Brief

## Status

This document records the intended architecture and implementation direction for
transporting structured WordPress data into Avenue Lit components. It is a design
brief, not a statement that every listed item remains unimplemented.

Current implemented slice:

- Component schemas validate explicit property transport and `attribute:false`.
- Prepared PHP props are partitioned into attribute and property buckets.
- The PHP component renderer exclusively serializes property props into
  `data-props`.
- Caller-supplied `data-props` is rejected as reserved.
- Card's `link` is validated through the Button contract and transported as a
  structured property.
- Card's Lit `link` and `image` declarations use `attribute:false`.
- The serialized-props mixin hydrates eligible properties reactively.
- PHP and browser tests cover serialization and hydration.

Image adaptation and transport remain intentionally deferred beyond the current
Card link example.

## Goal

Create one reusable system for transporting complex data from
WordPress/ACF/Gutenberg into Lit web components through a serialized
`data-props` attribute.

The system must:

- Preserve individual HTML attributes for primitive props.
- Use `data-props` only for complex props such as objects and arrays.
- Keep Lit components and `AvenueElement` WordPress-agnostic.
- Derive transport behavior from each component's `*.schema.json`.
- Validate ACF and block configuration against the component schema.
- Safely serialize complex values in PHP.
- Hydrate serialized values into real reactive Lit properties.
- Prevent `data-props` from overwriting attribute-backed props.
- Avoid duplicating component prop definitions across PHP and TypeScript.

The intended input channels are:

```text
Primitive configuration -> individual HTML attributes
Complex configuration   -> data-props JSON transport
Content/composition      -> slots and child components
```

`data-props` is a transport mechanism, not the canonical component API.

## Desired Output

```html
<ave-button
  variant="secondary"
  size="large"
  data-props='{
    "link": {
      "url": "/about/",
      "target": "_blank",
      "rel": "noopener"
    }
  }'
>
  About us
</ave-button>
```

The component should receive normal properties:

```ts
element.variant === 'secondary';

element.link === {
  url: '/about/',
  target: '_blank',
  rel: 'noopener',
};
```

The Lit API remains conventional:

```ts
@property({ type: String })
accessor variant = 'primary';

@property({ attribute: false })
accessor link?: LinkProps;
```

## Core Convention

Only properties explicitly declared as non-attribute properties are eligible for
`data-props` hydration:

```text
attribute !== false -> individual HTML attribute
attribute === false -> JavaScript property or data-props
```

Primitive attribute-backed props should not be placed in `data-props` without a
compelling future reason.

## Schema Contract

Each component schema should explicitly describe type and transport:

```json
{
  "props": {
    "variant": {
      "type": "string",
      "attribute": "variant",
      "transport": "attribute",
      "default": "primary"
    },
    "disabled": {
      "type": "boolean",
      "attribute": "disabled",
      "transport": "attribute",
      "default": false
    },
    "link": {
      "type": "object",
      "attribute": false,
      "transport": "property",
      "required": false,
      "properties": {
        "url": {
          "type": "string",
          "required": true
        },
        "target": {
          "type": "string",
          "enum": ["_self", "_blank"]
        },
        "rel": {
          "type": "string"
        }
      }
    },
    "items": {
      "type": "array",
      "attribute": false,
      "transport": "property",
      "items": {
        "type": "object"
      }
    }
  }
}
```

Schema rules:

```text
transport: "attribute"
- Maps to an HTML attribute.
- Intended primarily for strings, numbers, and booleans.
- `attribute` may be true or a string attribute name.

transport: "property"
- Must use `attribute: false`.
- Is eligible for data-props serialization.
- Intended primarily for objects, arrays, and structured values.
```

Explicit `transport` is preferred over inferred behavior because it provides a
clear build-time contract. If inference is ever supported, the expected defaults
are:

```text
object/array + attribute:false -> property
string/number/boolean          -> attribute
```

The schema stays platform-neutral: use `"property"`, not
`"data-props"`, as the transport name.

## Schema and Integration Validation

Reject these combinations:

```text
transport: "property" with attribute not equal to false
transport: "attribute" with attribute equal to false
object or array with transport: "attribute" without a supported converter
attribute name "data-props"
prop name "serializedProps"
unknown transport values
```

Also validate:

- Every ACF field maps to a declared schema prop.
- Every mapped prop uses a compatible ACF field type.
- Clone, group, and repeater fields map to property transport.
- Primitive fields map to attribute transport.
- Required status is compatible between the schema and ACF usage.
- Unknown props are rejected or reported during development.

## ACF Responsibilities

ACF definitions describe editor fields. The schema describes the platform-neutral
component contract. The WordPress adapter combines the two.

Example:

```php
$fields = [
    Field::build_field($component_name, 'variant', [
        'label' => 'Variant',
        'type' => 'select',
        'choices' => [
            'primary' => 'Primary',
            'secondary' => 'Secondary',
        ],
    ]),

    Field::build_clone($component_name, 'link', [
        'label' => 'Link',
        'clone' => ['group_button_link'],
        'display' => 'seamless',
    ]),
];
```

Expected mapping:

```text
variant -> ACF select -> schema string -> attribute transport
link    -> ACF clone  -> schema object -> property transport
```

The field builder does not need to own rendering decisions. The block/component
adapter should inspect schema metadata while mapping ACF values.

## `BlockFactory` Responsibilities

`BlockFactory` should validate integration before registration or rendering:

1. Load the component manifest and schema.
2. Confirm that the component supports an ACF block.
3. Confirm that configured ACF fields correspond to declared props.
4. Validate required-field overrides.
5. Validate clone-field dependencies.
6. Confirm that each prop has valid transport configuration.
7. Pass normalized schema metadata to the renderer or component mapper.

Example normalized metadata:

```php
[
    'variant' => [
        'type' => 'string',
        'transport' => 'attribute',
        'attribute' => 'variant',
        'required' => false,
    ],
    'link' => [
        'type' => 'object',
        'transport' => 'property',
        'attribute' => false,
        'required' => false,
    ],
]
```

Keep schema requirements and editor requirements distinct:

```text
schema required       -> component contract requirement
ACF required override -> editor/input requirement for this usage
```

An ACF integration may intentionally weaken an editor-level requirement without
mutating the canonical schema. The final mapped props must still pass component
validation. When a runtime-required prop is absent, the integration must provide
a valid default or preview value, skip rendering and report the problem, or
reject the configuration during registration.

`BlockFactory` should not become the component data mapper if doing so creates
unnecessary coupling.

## WordPress Data Mapping

Component mapping should separate values into two buckets:

```php
$attributes = [];
$serialized_props = [];
```

Conceptually:

```php
foreach ($schema['props'] as $prop_name => $definition) {
    $value = $acf_data[$prop_name] ?? null;

    if (!should_include_prop($definition, $value)) {
        continue;
    }

    if ($definition['transport'] === 'attribute') {
        $attribute_name = resolve_attribute_name(
            $prop_name,
            $definition
        );

        $attributes[$attribute_name] = normalize_attribute_value(
            $value,
            $definition
        );

        continue;
    }

    if ($definition['transport'] === 'property') {
        $serialized_props[$prop_name] = normalize_property_value(
            $value,
            $definition
        );
    }
}

if ($serialized_props !== []) {
    $attributes['data-props'] = $serialized_props;
}
```

Normalize common WordPress/ACF structures before serialization:

```text
ACF link array    -> Avenue LinkProps object
ACF image array   -> Avenue ImageProps object
ACF repeater rows -> array of normalized component objects
ACF clone field   -> nested object matching the cloned component schema
```

Component-specific normalization can remain in the component PHP class:

```php
final class Button
{
    public static function map(array $data): array
    {
        return [
            'variant' => $data['variant'] ?? 'primary',
            'link' => self::map_link($data['link'] ?? null),
        ];
    }
}
```

The generic renderer then uses the schema to choose individual attributes versus
`data-props`. This keeps normalization separate from transport.

## Contracts, Validation, Transforms, and Adapters

The component schema identifies canonical target shapes and validation rules,
not source systems or PHP implementation classes:

```json
{
  "link": {
    "type": "object",
    "attribute": false,
    "transport": "property",
    "contract": {
      "component": "button"
    }
  }
}
```

A component contract recursively uses the referenced component's prop schema.
For example, Card's `link` value is parsed against Button's prop definitions, so
Button remains the source of truth for required fields, enums, and defaults.

Reusable source transforms handle small representation differences before
schema parsing. Transforms belong to the source integration:

```php
[
    'name' => 'target',
    'type' => 'true_false',
    'avenue_transform' => [
        'type' => 'boolean-map',
        'true' => '_blank',
        'false' => '_self',
    ],
]
```

This avoids a component-specific adapter for an object that already closely
matches its canonical contract.

Adapters are reserved for genuine object-shape translations:

```text
wordpress + avenue/image  -> WordPressImageAdapter
```

Current responsibility split:

```text
required/type/enum/default/unknown props -> component schema parser
referenced component prop shapes         -> component contract
ACF true_false 0/1 to target enum        -> boolean-map transform
WordPress/ACF image data                  -> WordPressImageAdapter
```

The processing order is:

```text
raw integration value
-> apply source field transforms
-> resolve and apply a structured adapter only when required
-> validate the adapted value
-> partition by transport
-> serialize property values into data-props
```

Adapters translate source shapes but should not silently introduce
consumer-specific content policy. Decisions about label fallbacks or rejecting
an empty link belong to canonical validation or the consumer.

## PHP Attribute Rendering

The attribute renderer should understand structured JSON attribute values. A
possible explicit API is:

```php
Attrs::json($value);
Attrs::boolean($value);
Attrs::data($name, $value);
```

Example:

```php
$attrs = Attrs::render([
    'variant' => $props['variant'],
    'disabled' => Attrs::boolean($props['disabled']),
    'data-props' => Attrs::json([
        'link' => $props['link'],
    ]),
]);
```

Requirements:

- Use `wp_json_encode()` under WordPress.
- Apply `esc_attr()` after JSON encoding.
- Reject unsupported values such as resources and closures.
- Omit `data-props` when the serialized object is empty.
- Preserve valid `false`, `0`, empty arrays, and empty strings.
- Distinguish missing values from intentionally empty values.
- Throw or report JSON encoding failures during development.
- Do not manually concatenate JSON attributes in component templates.

Reference encoding:

```php
private static function encode_json_attribute(mixed $value): string
{
    $json = wp_json_encode(
        $value,
        JSON_UNESCAPED_SLASHES
        | JSON_UNESCAPED_UNICODE
        | JSON_THROW_ON_ERROR
    );

    return esc_attr($json);
}
```

## Serialized Props Mixin

Keep hydration separate from the main `AvenueElement` implementation in:

```text
src/internal/mixins/serialized-props.mixin.ts
```

The mixin should:

- Declare `serializedProps` as the `data-props` string attribute.
- Parse only JSON objects; reject arrays, `null`, primitives, and malformed JSON.
- Hydrate only declared Lit properties whose declaration has
  `attribute === false`.
- Ignore unknown keys.
- Never hydrate its own reserved `serializedProps` property.
- Assign values as normal reactive property assignments.
- Rehydrate when `data-props` changes.
- Dispatch a bubbling, composed `avenue-invalid-props` event for invalid input.

The intended eligibility check is:

```ts
protected canHydrateProperty(name: string): boolean {
  if (name === 'serializedProps') {
    return false;
  }

  const constructor = this.constructor as typeof ReactiveElement;
  const declaration = constructor.elementProperties.get(name);

  return declaration?.attribute === false;
}
```

Use an explicit exported mixin return type and a named exported function:

```ts
export function SerializedPropsMixin(...) {}
```

Do not rely on the inferred return type of an exported arrow function. Explicit
typing avoids TS4023 declaration-generation failures that can cause TypeScript to
walk into unrelated augmented dependency types.

## `AvenueElement` Integration

`AvenueElement` may be abstract because it is framework infrastructure and should
not be instantiated or registered directly:

```ts
import { LitElement } from 'lit';
import { SerializedPropsMixin } from './mixins/serialized-props.mixin.js';

export abstract class AvenueElement extends SerializedPropsMixin(
  LitElement,
) {
  // Existing AvenueElement behavior.
}
```

It does not require abstract methods. The generic mixin should continue to accept
a normal constructor type; abstractness is a decision belonging to
`AvenueElement`.

Preserve the project's existing Lit decorator convention. Do not inconsistently
mix legacy field decorators and standard `accessor` decorators.

## End-to-End Flow

```text
1. Component schema defines the prop contract and transport.
2. ACF PHP defines editor fields.
3. BlockFactory validates ACF configuration against the schema.
4. Component PHP mapper normalizes raw ACF values.
5. Generic renderer separates attribute props from property props.
6. Property props are encoded into data-props.
7. Attribute helper safely renders all attributes.
8. AvenueElement mixin parses data-props.
9. Mixin confirms that every key is a declared Lit property.
10. Mixin hydrates only properties with attribute:false.
11. Lit receives normal reactive assignments.
12. Existing Avenue validation runs against hydrated properties.
```

Validation belongs at multiple boundaries:

```text
Build/registration
- schema structure
- ACF/schema compatibility
- invalid transport declarations

PHP mapping/rendering
- normalized value types
- required props
- JSON encoding

Browser runtime
- valid JSON object
- declared Lit property
- attribute:false eligibility
- existing AvenueElement validation
```

## Precedence

Recommended precedence:

```text
1. Direct JavaScript property assignment
2. Individual HTML attribute
3. data-props hydration
4. Component default
```

The strict `attribute === false` hydration rule keeps the individual-attribute
and serialized-property sets separate. Avoid sending the same prop through both:

```html
<!-- Avoid -->
<ave-button
  variant="secondary"
  data-props='{"variant":"primary"}'
></ave-button>

<!-- Prefer -->
<ave-button
  variant="secondary"
  data-props='{"link":{"url":"/about/"}}'
></ave-button>
```

## Scope Limits

Use `data-props` for:

- Links and images.
- Nested configuration objects.
- Short arrays.
- ACF clone/group values.
- Structured non-markup data.

Do not use it for:

- Rich text HTML.
- Very large repeated sections.
- Entire block payloads.
- Child component markup.
- Content that naturally belongs in slots.

```html
<ave-card
  theme="light"
  data-props='{
    "image": {
      "src": "/campus.jpg",
      "alt": "Campus"
    },
    "link": {
      "url": "/programs/"
    }
  }'
>
  <h3 slot="title">Programs</h3>
  <div slot="content">
    Rich content remains markup.
  </div>
</ave-card>
```

## Suggested Responsibilities

```text
components/button/button.schema.json
- prop types, validation, attributes, and transport declarations

components/button/button.acf.php
- ACF editor field definitions and field-specific overrides

components/button/button.class.php
- component-specific ACF-to-prop normalization

wordpress/acf/BlockFactory.php
- validate block/ACF integration, resolve dependencies, pass schema metadata

wordpress/rendering/ComponentRenderer.php
- split mapped props by transport, validate values, render the element

wordpress/rendering/AttributeHelper.php
- boolean/string/data attributes, JSON encoding, and escaping

internal/mixins/serialized-props.mixin.ts
- parse data-props, enforce eligibility, assign values, report invalid input

internal/avenue-element.ts
- abstract Avenue base, mixin composition, existing validation lifecycle
```

These names describe responsibilities; implementation should adapt them to the
repository's actual class and file names.

## Implementation Order

1. Finalize schema shape for `transport`, `attribute`, objects, and arrays.
2. Add validation for invalid schema transport combinations.
3. Add schema loading to the WordPress registry/`BlockFactory`.
4. Add generic prop splitting to the component renderer.
5. Add safe JSON support to the attribute renderer.
6. Implement `SerializedPropsMixin`.
7. Apply the mixin to abstract `AvenueElement`.
8. Update Button schema with a complex `link` property.
9. Normalize the Button ACF clone field into `link` props.
10. Render Button using primitive attributes plus `data-props`.
11. Add PHP serialization tests.
12. Add browser tests for hydration, malformed JSON, and unknown props.
13. Test inside the Gutenberg iframe editor.
14. Expand the pattern to Card image/link objects and repeater data.

Before implementation, compare this sequence with current repository state:
several of these pieces may already exist or be partially implemented.

## Minimum Tests

### Schema

```text
property transport requires attribute:false
attribute transport rejects object and array types
data-props and serializedProps names are reserved
unknown transport values fail
```

### PHP

```text
primitive values become individual attributes
object values become data-props
empty property payload omits data-props
JSON is escaped correctly
quotes and Unicode survive serialization
boolean false is handled intentionally
invalid values produce an error
```

### Lit

```text
valid data-props hydrates an attribute:false property
unknown keys are ignored
attribute-backed props are not hydrated
malformed JSON dispatches avenue-invalid-props
array root JSON is rejected
null root JSON is rejected
changing data-props rehydrates properties
hydrated assignments trigger Lit updates
```

### Gutenberg

```text
complex objects survive React/Gutenberg rendering
attributes remain readable in editor markup
iframe rendering matches front-end rendering
inline editing does not destroy data-props
re-renders update complex properties
```

## Open Design Decision

Initial behavior:

```text
A changed data-props attribute is authoritative for property-transport props.
```

This is predictable for server-rendered and Gutenberg-controlled components. It
means a later `data-props` mutation can overwrite a direct property assignment
made after initial hydration. Components that need mutable complex state should
copy hydrated public props into separate internal state rather than mutate public
input props.

## Final Principle

`data-props` solves serialization across the HTML/React boundary without becoming
the public component API.

The public API remains normal Lit properties, attributes, and slots. WordPress
chooses how to transport those values; the component does not know or care
whether Gutenberg, ACF, or PHP produced them.
