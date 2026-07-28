<?php

declare(strict_types=1);

namespace AvenueUI\Blocks;

use Avenue\ACF\FieldBuilder;
use AvenueUI\Components\Card;

return [
   'name' => 'card',
   'title' => 'Card',
   'description' => 'Card component',
   'field_group_key' => FieldBuilder::build_group_key('card', 'component'),
   'category' => 'ave-components',
   'icon' => 'admin-generic',
   'keywords' => ['card'],
   'component' => Card::class,
   'preview_props' => [
      'title' => 'Card',
   ],
   'map_fields' => static function (
       array $fields, array $block, bool $is_preview, int|string $post_id
   ): array {
      return [
         'props' => [
            'image' => null,
         ],
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
   ]
];
