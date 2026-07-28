<?php

declare(strict_types=1);

use AvenueUI\WordPress\AcfFieldInspector;
use AvenueUI\WordPress\RequiredFieldValidator;
use AvenueUI\WordPress\Utils\NestedArray;

require_once __DIR__ . '/../../src/wordpress/utils/NestedArray.php';
require_once __DIR__ . '/../../src/wordpress/acf/AcfFieldInspector.php';
require_once __DIR__ . '/../../src/wordpress/acf/RequiredFieldValidator.php';

/**
 * Assert that two values are strictly equal.
 *
 * @param mixed  $expected Expected value.
 * @param mixed  $actual   Actual value.
 * @param string $message  Failure message.
 *
 * @return void
 */
function avenue_acf_assert_same(mixed $expected, mixed $actual, string $message): void
{
    if ($expected === $actual) {
        return;
    }

    throw new RuntimeException(
        sprintf(
            "%s\nExpected: %s\nActual: %s",
            $message,
            var_export($expected, true),
            var_export($actual, true)
        )
    );
}

/**
 * Return fixture ACF field groups.
 *
 * @return array<int, array<string, mixed>> Field groups.
 */
function acf_get_field_groups(): array
{
    return [
        [
            'key' => 'group_ave_card_component',
            'location' => [],
        ],
    ];
}

/**
 * Return fixture fields for an ACF field group.
 *
 * @param array<string, mixed> $group Field group.
 *
 * @return array<int, array<string, mixed>> Field definitions.
 */
function acf_get_fields(array $group): array
{
    return [
        [
            'key' => 'field_ave_card_title',
            'name' => 'title',
            'label' => 'Title',
            'required' => 1,
        ],
        [
            'key' => 'field_ave_card_content',
            'name' => 'content',
            'label' => 'Content',
            'required' => 0,
            'sub_fields' => [
                [
                    'key' => 'field_ave_card_link',
                    'name' => 'link',
                    'label' => 'Link',
                    'required' => 1,
                ],
            ],
        ],
    ];
}

avenue_acf_assert_same(
    [
        'card' => [
            'field_ave_card_title' => [
                'name' => 'title',
                'key' => 'field_ave_card_title',
                'label' => 'Title',
            ],
            'field_ave_card_link' => [
                'name' => 'link',
                'key' => 'field_ave_card_link',
                'label' => 'Link',
            ],
        ],
    ],
    AcfFieldInspector::requiredFieldsByComponent(),
    'Required ACF fields should be discovered once in a normalized shape.'
);

avenue_acf_assert_same(
    '/about/',
    AcfFieldInspector::resolveBlockFieldValue(
        [
            '_link' => 'field_ave_card_link',
            'field_ave_card_link' => '/about/',
        ],
        'link',
        'field_ave_card_link'
    ),
    'Block values should resolve through ACF field keys and pointers.'
);

$posted = [
    'field_parent' => [
        'field_ave_card_link' => '',
    ],
];

avenue_acf_assert_same(
    true,
    NestedArray::containsKey($posted, 'field_ave_card_link'),
    'Nested array lookup should find deeply nested keys.'
);
avenue_acf_assert_same(
    '',
    NestedArray::findByKey($posted, 'field_ave_card_link'),
    'Nested array lookup should preserve intentionally empty values.'
);
avenue_acf_assert_same(
    'Card: Title is required.',
    RequiredFieldValidator::validateValue(
        true,
        '',
        [
            'key' => 'field_ave_card_title',
            'label' => 'Title',
            'required' => 1,
        ],
        'acf[field_ave_card_title]'
    ),
    'Required-value validation should retain component-aware error messages.'
);
avenue_acf_assert_same(
    true,
    RequiredFieldValidator::validateValue(
        true,
        0,
        [
            'key' => 'field_ave_card_count',
            'label' => 'Count',
            'required' => 1,
        ],
        'acf[field_ave_card_count]'
    ),
    'Required-value validation should preserve meaningful falsey values.'
);

fwrite(STDOUT, "ACF required-field validation checks passed.\n");
