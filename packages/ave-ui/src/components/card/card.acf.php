<?php

declare(strict_types=1);

namespace AvenueUI\ACF;

use Avenue\ACF\ComponentFields;
use Avenue\ACF\FieldBuilder as Field;

final class CardFields extends ComponentFields
{
   protected static function component_name(): string
   {
      return 'card';
   }

   /**
    * Define the card's canonical fields.
    *
    * @return array<int, array<string, mixed>>
    */
   protected static function define_fields(): array
   {
      $component = static::component_name();

      $button_fields = ButtonFields::materialize(
         consumer_component: $component,
         overrides: [
            'label' => [
               'required' => 0,
            ],
         ],
         exclude: ['icon'],
         namespace: 'action_button',
      );

      return [
         Field::build_field(
            $component,
            'title',
            [
               'label' => 'Title',
               'type' => 'text',
               'required' => 1,
               'instructions' => 'The text displayed in the component.',
            ],
         ),

         Field::build_field(
            $component,
            'text',
            [
               'label' => 'Text',
               'type' => 'textarea',
               'rows' => 4,
            ],
         ),

         Field::build_field(
            $component,
            'image',
            [
               'label' => 'Image',
               'type' => 'image',
               'return_format' => 'array',
               'preview_size' => 'medium',
            ],
         ),

         Field::build_group(
            $component,
            'link',
            $button_fields,
         ),
      ];
   }

   /**
    * Define the card field group's default configuration.
    *
    * @return array<string, mixed>
    */
   protected static function field_group_config(): array
   {
      return [
         'title' => 'Card',
         'location' => [],
         'style' => 'seamless',
         'wrap' => false,
      ];
   }
}

CardFields::register();
