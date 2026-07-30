<?php

declare(strict_types=1);

use Avenue\ACF\ComponentFields;
use Avenue\ACF\FieldBuilder;

require_once __DIR__ . '/../../src/FieldBuilder.php';
require_once __DIR__ . '/../../src/ComponentFields.php';

/**
 * Reusable fixture fields for materialization tests.
 */
final class FieldBuilderActionFixture extends ComponentFields
{
    /**
     * Return the fixture component name.
     *
     * @return string Fixture component name.
     */
    protected static function component_name(): string
    {
        return 'action';
    }

    /**
     * Define generic reusable action fields.
     *
     * @return array<int, array<string, mixed>> Fixture fields.
     */
    protected static function define_fields(): array
    {
        return [
            FieldBuilder::build_field(
                static::component_name(),
                'label',
                [
                    'label' => 'Label',
                    'type' => 'text',
                    'required' => 1,
                ]
            ),
            FieldBuilder::build_field(
                static::component_name(),
                'variant',
                [
                    'label' => 'Variant',
                    'type' => 'select',
                    'choices' => [
                        'primary' => 'Primary',
                        'secondary' => 'Secondary',
                    ],
                ]
            ),
        ];
    }
}

/**
 * Assert that two values are strictly equal.
 *
 * @param mixed  $expected Expected value.
 * @param mixed  $actual   Actual value.
 * @param string $label    Assertion label.
 *
 * @return void
 */
function avenue_field_builder_assert_same(
    mixed $expected,
    mixed $actual,
    string $label
): void {
    if ($actual === $expected) {
        return;
    }

    throw new RuntimeException(
        sprintf(
            '%s failed. Expected %s; received %s.',
            $label,
            var_export($expected, true),
            var_export($actual, true)
        )
    );
}

$primaryFields = FieldBuilderActionFixture::materialize(
    consumer_component: 'consumer',
    namespace: 'primary_action'
);
$secondaryFields = FieldBuilderActionFixture::materialize(
    consumer_component: 'consumer',
    namespace: 'secondary_action'
);

avenue_field_builder_assert_same(
    ['label', 'variant'],
    array_column($primaryFields, 'name'),
    'Materialized canonical field names'
);
avenue_field_builder_assert_same(
    false,
    ($primaryFields[0]['key'] ?? null)
        === ($secondaryFields[0]['key'] ?? null),
    'Namespaced materialization keys'
);

$repeater = FieldBuilder::build_repeater(
    'consumer',
    'actions',
    $primaryFields,
    [
        'name' => 'canonicalActions',
        'label' => 'Actions',
        'layout' => 'table',
        'max' => 2,
    ]
);

avenue_field_builder_assert_same(
    'repeater',
    $repeater['type'] ?? null,
    'Repeater structural type'
);
avenue_field_builder_assert_same(
    'canonicalActions',
    $repeater['name'] ?? null,
    'Repeater canonical name override'
);
avenue_field_builder_assert_same(
    'table',
    $repeater['layout'] ?? null,
    'Repeater layout option'
);
avenue_field_builder_assert_same(
    2,
    $repeater['max'] ?? null,
    'Repeater maximum option'
);
avenue_field_builder_assert_same(
    $primaryFields,
    $repeater['sub_fields'] ?? null,
    'Repeater materialized sub-fields'
);

echo "FieldBuilder checks passed.\n";
