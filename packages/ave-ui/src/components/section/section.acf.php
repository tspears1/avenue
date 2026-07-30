<?php

declare(strict_types=1);

namespace AvenueUI\ACF;

use Avenue\ACF\ComponentFields;
use Avenue\ACF\FieldBuilder as Field;

final class SectionFields extends ComponentFields
{
    /**
     * Return the component slug used for deterministic ACF keys.
     *
     * @return string Component slug.
     */
    protected static function component_name(): string
    {
        return 'section';
    }

    /**
     * Define the Section component's canonical editor fields.
     *
     * @return array<int, array<string, mixed>> Section field definitions.
     */
    protected static function define_fields(): array
    {
        $component = static::component_name();
        $headerButtonFields = ButtonFields::materialize(
            consumer_component: $component,
            exclude: ['icon'],
            namespace: 'header_button',
        );
        $footerButtonFields = ButtonFields::materialize(
            consumer_component: $component,
            exclude: ['icon'],
            namespace: 'footer_button',
        );

        return [
            Field::build_field(
                $component,
                'element_id',
                [
                    'name' => 'elementId',
                    'label' => 'Section ID',
                    'type' => 'text',
                    'instructions' => 'Optional ID attribute for the section element.',
                ],
            ),

            Field::build_field(
                $component,
                'appearance',
                [
                    'label' => 'Appearance',
                    'type' => 'select',
                    'choices' => [
                        'light' => 'Light',
                        'dark' => 'Dark',
                    ],
                    'default_value' => 'light',
                    'instructions' => 'The appearance of the section.',
                ],
            ),

            Field::build_field(
                $component,
                'additional_classes',
                [
                    'name' => 'additionalClasses',
                    'label' => 'Additional Classes',
                    'type' => 'text',
                    'instructions' => 'Additional classes to add to the section element.',
                ],
            ),

            Field::build_group(
                $component,
                'header',
                [
                    Field::build_field(
                        $component,
                        'header_heading',
                        [
                            'name' => 'heading',
                            'label' => 'Heading',
                            'type' => 'text',
                            'instructions' => 'The primary heading displayed in the section header.',
                        ],
                    ),
                    Field::build_field(
                        $component,
                        'header_intro',
                        [
                            'name' => 'intro',
                            'label' => 'Introduction',
                            'type' => 'textarea',
                            'rows' => 4,
                            'instructions' => 'Introductory text displayed below the heading.',
                        ],
                    ),
                    Field::build_repeater(
                        $component,
                        'header_buttons',
                        $headerButtonFields,
                        [
                            'name' => 'buttons',
                            'label' => 'Buttons',
                            'button_label' => 'Add Header Button',
                            'layout' => 'block',
                            'max' => 2,
                        ],
                    ),
                ],
                [
                    'label' => 'Section Header',
                ],
            ),

            Field::build_group(
                $component,
                'footer',
                [
                    Field::build_field(
                        $component,
                        'footer_heading',
                        [
                            'name' => 'heading',
                            'label' => 'Heading',
                            'type' => 'text',
                            'instructions' => 'The heading displayed in the section footer.',
                        ],
                    ),
                    Field::build_field(
                        $component,
                        'footer_outro',
                        [
                            'name' => 'outro',
                            'label' => 'Closing Text',
                            'type' => 'textarea',
                            'rows' => 4,
                            'instructions' => 'Closing text displayed in the section footer.',
                        ],
                    ),
                    Field::build_repeater(
                        $component,
                        'footer_buttons',
                        $footerButtonFields,
                        [
                            'name' => 'buttons',
                            'label' => 'Buttons',
                            'button_label' => 'Add Footer Button',
                            'layout' => 'block',
                            'max' => 2,
                        ],
                    ),
                ],
                [
                    'label' => 'Section Footer',
                ],
            ),
        ];
    }

    /**
     * Define the Section field group's default registration settings.
     *
     * @return array<string, mixed> Field group configuration.
     */
    protected static function field_group_config(): array
    {
        return [
            'title' => 'Section',
            'location' => [],
            'style' => 'seamless',
            'wrap' => false,
        ];
    }
}

SectionFields::register();
