<?php

declare(strict_types=1);

namespace AvenueUI\Blocks;

use Avenue\ACF\AdapterContext;
use Avenue\ACF\AdapterRegistry;
use Avenue\ACF\FieldBuilder;
use AvenueUI\Components\Image;

return [
   'name' => 'image',
   'title' => 'Image',
   'description' => 'Image component',
   'field_group_key' => FieldBuilder::build_group_key('image', 'component'),
   'category' => 'ave-components',
   'icon' => 'admin-generic',
   'keywords' => ['image'],
   'component' => Image::class,
   'map_fields_only' => true,
   'map_fields' => static function (
      array $fields,
      array $block,
      bool $is_preview,
      int|string $post_id
   ): array {
      $props = AdapterRegistry::adapt(
         'avenue/image',
         $fields['image'] ?? null,
         [],
         new AdapterContext(
            platform: 'wordpress',
            component: 'image',
            prop: 'image',
            is_preview: $is_preview,
            post_id: $post_id,
         ),
      );

      return [
         'props' => is_array($props) ? $props : [],
      ];
   },
   'supports' => [
      'align' => true,
      'anchor' => true,
      'mode' => true,
      'jsx' => false,
      'html' => false,
      'customClassName' => true,
      'className' => true,
   ],
];
