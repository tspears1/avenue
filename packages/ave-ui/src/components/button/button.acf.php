<?php

declare(strict_types=1);

namespace AvenueUI\ACF;

use Avenue\ACF\FieldBuilder as Field;

if (!function_exists('acf_add_local_field_group')) {
   return;
}

$component_name = 'button';

$fields = [
   Field::build_field($component_name, 'label', [
      'label' => 'Label',
      'type' => 'text',
      'instructions' => 'The text displayed on the button',
   ]),
   Field::build_field($component_name, 'variant', [
      'label' => 'Variant',
      'type' => 'select',
      'choices' => [
         'primary' => 'Primary',
         'secondary' => 'Secondary',
         'outline' => 'Outline',
      ],
      'default_value' => 'primary',
   ]),
   Field::build_field($component_name, 'href', [
      'label' => 'URL',
      'type' => 'url',
      'instructions' => 'Where the button links to',
   ]),
   Field::build_field($component_name, 'target', [
      'label' => 'Open in New Tab',
      'type' => 'true_false',
   ]),
   Field::build_field($component_name, 'icon', [
      'label' => 'Icon',
      'type' => 'text',
      'instructions' => 'Icon identifier (optional)',
   ]),
];

$field_group = Field::build_field_group($component_name, $fields, [
   'title' => 'Button',
   'location' => [],
   'style' => 'seamless',
   'wrap' => false,
]);

acf_add_local_field_group($field_group);
