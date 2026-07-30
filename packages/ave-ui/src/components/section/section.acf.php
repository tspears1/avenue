<?php

declare(strict_types=1);

namespace AvenueUI\ACF;

use Avenue\ACF\ComponentFields;
use Avenue\ACF\FieldBuilder as Field;

final class SectionFields extends ComponentFields
{
    protected static function component_name(): string
    {
        return 'section';
    }

    /**
        * @return array<int, array<string, mixed>>
        */
    protected static function define_fields(): array
    {
        $component = static::component_name();

        return [
            Field::build_field(
                $component,
                'label',
                [
                'label' => 'Label',
                'type' => 'text',
                'required' => 1,
                'instructions' => 'The text displayed on the component.',
                ],
            ),
        ];
    }

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
