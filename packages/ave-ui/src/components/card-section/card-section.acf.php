<?php

declare(strict_types=1);

namespace AvenueUI\ACF;

use Avenue\ACF\ComponentFields;
use Avenue\ACF\FieldBuilder as Field;

final class CardSectionFields extends ComponentFields
{
    /**
     * Return the component slug used for deterministic ACF keys.
     *
     * @return string Component slug.
     */
    protected static function component_name(): string
    {
        return 'card-section';
    }

    /**
     * Define the Card Section pattern's canonical editor fields.
     *
     * @return array<int, array<string, mixed>> Card Section field definitions.
     */
    protected static function define_fields(): array
    {
        $component = static::component_name();
        $sectionFields = SectionFields::materialize(
            consumer_component: $component,
            namespace: 'section',
        );
        $cardFields = CardFields::materialize(
            consumer_component: $component,
            namespace: 'card',
        );

        return [
            Field::build_group(
                $component,
                'section',
                $sectionFields,
                [
                    'label' => 'Section',
                    'required' => 1,
                ],
            ),

            Field::build_repeater(
                $component,
                'cards',
                $cardFields,
                [
                    'label' => 'Cards',
                    'button_label' => 'Add Card',
                    'layout' => 'block',
                    'required' => 1,
                    'min' => 1,
                ],
            ),
        ];
    }

    /**
     * Define the Card Section field group's default registration settings.
     *
     * @return array<string, mixed> Field group configuration.
     */
    protected static function field_group_config(): array
    {
        return [
            'title' => 'Card Section',
            'location' => [],
            'style' => 'seamless',
            'wrap' => false,
        ];
    }
}

CardSectionFields::register();
