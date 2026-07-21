<?php

declare(strict_types=1);

namespace AvenueUI\ACF;

use Avenue\ACF\FieldBuilder as Field;

if (!function_exists('acf_add_local_field_group')) {
   return;
}

$component_name = 'card';

$fields = [
   Field::build_field($component_name, 'title', [
      'label' => 'Title',
      'type' => 'text',
      'required' => 1,
      'instructions' => 'The text displayed in the component',
   ]),
   Field::build_field($component_name, 'text', [
      'label' => 'Text',
      'type' => 'textarea',
      'rows' => 4,
   ]),
   Field::build_field($component_name, 'image', [
      'label' => 'Image',
      'type' => 'image',
      'return_format' => 'array',
      'preview_size' => 'medium',
   ]),
   Field::build_repeater($component_name, 'actions', [
      Field::build_clone($component_name, 'button', null),
   ], [
      'label' => 'Buttons',
   ])
];

$field_group = Field::build_field_group($component_name, $fields, [
   'title' => 'Card',
   'location' => [],
   'style' => 'seamless',
   'wrap' => false,
]);

acf_add_local_field_group($field_group);
