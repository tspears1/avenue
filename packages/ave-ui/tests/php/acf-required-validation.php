<?php

declare(strict_types=1);

use AvenueUI\WordPress\ACF\AcfFieldInspector;
use AvenueUI\WordPress\ACF\RequiredFieldValidator;
use AvenueUI\WordPress\Utils\NestedArray;

require_once __DIR__ . '/../../src/WordPress/Utils/NestedArray.php';
require_once __DIR__ . '/../../src/WordPress/ACF/AcfFieldInspector.php';
require_once __DIR__ . '/../../src/WordPress/ACF/RequiredFieldValidator.php';

if (!class_exists('WP_REST_Request')) {
    final class WP_REST_Request
    {
        /**
         * @param array<string, mixed> $params Request parameters.
         */
        public function __construct(private array $params)
        {
        }

        /**
         * Return one request parameter.
         *
         * @param string $name Parameter name.
         *
         * @return mixed Parameter value.
         */
        public function get_param(string $name): mixed
        {
            return $this->params[$name] ?? null;
        }
    }
}

if (!class_exists('WP_Error')) {
    final class WP_Error
    {
        /**
         * @param string               $code    Error code.
         * @param string               $message Error message.
         * @param array<string, mixed> $data    Error data.
         */
        public function __construct(
            public string $code,
            public string $message,
            public array $data = []
        ) {
        }
    }
}

/**
 * Parse JSON-encoded block fixtures.
 *
 * @param string $content Encoded block fixtures.
 *
 * @return array<int, array<string, mixed>> Parsed blocks.
 */
function parse_blocks(string $content): array
{
    $blocks = json_decode($content, true);

    return is_array($blocks) ? $blocks : [];
}

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
            'location' => [
                [
                    [
                        'param' => 'block',
                        'operator' => '==',
                        'value' => 'acf/card',
                    ],
                ],
            ],
        ],
        [
            'key' => 'group_ave_card_section_component',
            'location' => [
                [
                    [
                        'param' => 'block',
                        'operator' => '==',
                        'value' => 'acf/card-section',
                    ],
                ],
            ],
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
    if (($group['key'] ?? null) === 'group_ave_card_section_component') {
        return [
            [
                'key' => 'field_ave_card_section_group_section',
                'name' => 'section',
                'label' => 'Section',
                'type' => 'group',
                'required' => 1,
                'sub_fields' => [
                    [
                        'key' => 'field_ave_card_section_header',
                        'name' => 'header',
                        'label' => 'Header',
                        'type' => 'group',
                        'required' => 0,
                        'sub_fields' => [
                            [
                                'key' => 'field_ave_card_section_header_buttons',
                                'name' => 'buttons',
                                'label' => 'Buttons',
                                'type' => 'repeater',
                                'required' => 0,
                                'sub_fields' => [
                                    [
                                        'key' => 'field_ave_card_section_header_button_label',
                                        'name' => 'label',
                                        'label' => 'Label',
                                        'type' => 'text',
                                        'required' => 1,
                                    ],
                                ],
                            ],
                        ],
                    ],
                ],
            ],
            [
                'key' => 'field_ave_card_section_repeater_cards',
                'name' => 'cards',
                'label' => 'Cards',
                'type' => 'repeater',
                'required' => 1,
            ],
        ];
    }

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
        'card-section' => [
            'field_ave_card_section_group_section' => [
                'name' => 'section',
                'key' => 'field_ave_card_section_group_section',
                'label' => 'Section',
            ],
            'field_ave_card_section_header_button_label' => [
                'name' => 'label',
                'key' => 'field_ave_card_section_header_button_label',
                'label' => 'Label',
            ],
            'field_ave_card_section_repeater_cards' => [
                'name' => 'cards',
                'key' => 'field_ave_card_section_repeater_cards',
                'label' => 'Cards',
            ],
        ],
    ],
    AcfFieldInspector::requiredFieldsByComponent(),
    'Required ACF fields should be discovered once in a normalized shape.'
);

avenue_acf_assert_same(
    [
        'card' => [
            'field_ave_card_title' => [
                'name' => 'title',
                'key' => 'field_ave_card_title',
                'label' => 'Title',
            ],
        ],
        'card-section' => [
            'field_ave_card_section_group_section' => [
                'name' => 'section',
                'key' => 'field_ave_card_section_group_section',
                'label' => 'Section',
            ],
            'field_ave_card_section_repeater_cards' => [
                'name' => 'cards',
                'key' => 'field_ave_card_section_repeater_cards',
                'label' => 'Cards',
            ],
        ],
    ],
    AcfFieldInspector::requiredFieldsByComponent(includeNested: false),
    'Root-only requirements should exclude conditional repeater sub-fields.'
);

avenue_acf_assert_same(
    'card-section',
    AcfFieldInspector::componentNameFromGroupKey(
        'group_ave_card_section_component'
    ),
    'Multiword component group keys should retain their complete slug.'
);
avenue_acf_assert_same(
    'card-section',
    AcfFieldInspector::componentNameFromGroup([
        'key' => 'group_ave_card_component',
        'location' => [
            [
                [
                    'param' => 'block',
                    'value' => 'acf/card-section',
                ],
            ],
        ],
    ]),
    'An explicit block location should take precedence over a generated key.'
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

$cardOnlyRequest = new WP_REST_Request([
    'content' => json_encode([
        [
            'blockName' => 'acf/card',
            'attrs' => [
                'data' => [
                    'title' => 'Standalone Card',
                ],
            ],
            'innerBlocks' => [],
        ],
    ], JSON_THROW_ON_ERROR),
]);
$preparedPost = (object) ['post_title' => 'Example'];

avenue_acf_assert_same(
    $preparedPost,
    RequiredFieldValidator::validateRestRequest(
        $preparedPost,
        $cardOnlyRequest
    ),
    'A Card block should never validate Card Section requirements.'
);

$missingCardSectionFields = RequiredFieldValidator::validateRestRequest(
    $preparedPost,
    new WP_REST_Request([
        'content' => json_encode([
            [
                'blockName' => 'acf/card-section',
                'attrs' => [
                    'data' => [],
                ],
                'innerBlocks' => [],
            ],
        ], JSON_THROW_ON_ERROR),
    ])
);

avenue_acf_assert_same(
    WP_Error::class,
    is_object($missingCardSectionFields)
        ? $missingCardSectionFields::class
        : get_debug_type($missingCardSectionFields),
    'A Card Section should still validate its root requirements.'
);
avenue_acf_assert_same(
    'Card Section: Section is required. | Card Section: Cards is required.',
    $missingCardSectionFields->message,
    'Nested Button labels should not be treated as root requirements.'
);

avenue_acf_assert_same(
    $preparedPost,
    RequiredFieldValidator::validateRestRequest(
        $preparedPost,
        new WP_REST_Request([
            'content' => json_encode([
                [
                    'blockName' => 'acf/card-section',
                    'attrs' => [
                        'data' => [
                            'section' => [
                                'appearance' => 'light',
                            ],
                            'cards' => [
                                [
                                    'title' => 'Card',
                                ],
                            ],
                        ],
                    ],
                    'innerBlocks' => [],
                ],
            ], JSON_THROW_ON_ERROR),
        ])
    ),
    'A populated Card Section should pass root REST validation.'
);

fwrite(STDOUT, "ACF required-field validation checks passed.\n");
