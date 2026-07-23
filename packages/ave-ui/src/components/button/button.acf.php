<?php

declare(strict_types=1);

namespace AvenueUI\ACF;

use Avenue\ACF\ComponentFields;
use Avenue\ACF\FieldBuilder as Field;

final class ButtonFields extends ComponentFields
{
   protected static function component_name(): string
   {
      return 'button';
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
               'instructions' => 'The text displayed on the button.',
            ],
         ),

         Field::build_field(
            $component,
            'variant',
            [
               'label' => 'Variant',
               'type' => 'select',
               'choices' => [
                  'primary' => 'Primary',
                  'secondary' => 'Secondary',
                  'outline' => 'Outline',
               ],
               'default_value' => 'primary',
            ],
         ),

         Field::build_field(
            $component,
            'href',
            [
               'label' => 'URL',
               'type' => 'url',
               'instructions' => 'Where the button links to.',
            ],
         ),

         Field::build_field(
            $component,
            'target',
            [
               'label' => 'Open in New Tab',
               'type' => 'true_false',
            ],
         ),

         Field::build_field(
            $component,
            'icon',
            [
               'label' => 'Icon',
               'type' => 'text',
               'instructions' => 'Icon identifier (optional).',
            ],
         ),
      ];
   }

   protected static function field_group_config(): array
   {
      return [
         'title' => 'Button',
         'location' => [],
         'style' => 'seamless',
         'wrap' => false,
      ];
   }
}

ButtonFields::register();