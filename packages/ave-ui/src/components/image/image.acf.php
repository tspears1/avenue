<?php

declare(strict_types=1);

namespace AvenueUI\ACF;

use Avenue\ACF\FieldBuilder as Field;

if (!function_exists('acf_add_local_field_group')) {
   return;
}

$component_name = 'image';

$fields = [
   Field::build_field($component_name, 'label', [
      'label' => 'Label',
      'type' => 'text',
      'required' => 1,
      'instructions' => 'The text displayed in the component',
   ]),
];

$field_group = Field::build_field_group($component_name, $fields, [
   'title' => 'Image',
   'location' => [],
   'style' => 'seamless',
   'wrap' => false,
]);

acf_add_local_field_group($field_group);
