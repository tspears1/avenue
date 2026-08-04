<?php

declare(strict_types=1);

use Avenue\ACF\AdapterContext;
use Avenue\ACF\AdapterRegistry;
use Avenue\ACF\DefaultTransforms;
use Avenue\ACF\TransformRegistry;
use AvenueUI\Core\ComponentSchema;
use AvenueUI\WordPress\ValueAdapters;

require_once __DIR__ . '/../../../ave-acf/src/AdapterContext.php';
require_once __DIR__ . '/../../../ave-acf/src/ValueAdapter.php';
require_once __DIR__ . '/../../../ave-acf/src/AdapterRegistry.php';
require_once __DIR__ . '/../../../ave-acf/src/ValueTransform.php';
require_once __DIR__ . '/../../../ave-acf/src/TransformRegistry.php';
require_once __DIR__ . '/../../../ave-acf/src/BooleanMapTransform.php';
require_once __DIR__ . '/../../../ave-acf/src/DefaultTransforms.php';
require_once __DIR__ . '/../../../ave-acf/src/Helper.php';
require_once __DIR__ . '/../../../ave-acf/src/BlockFactory.php';
require_once __DIR__ . '/../../src/Core/AttributeRenderer.php';
require_once __DIR__ . '/../../src/Core/SchemaValidationIssue.php';
require_once __DIR__ . '/../../src/Core/SchemaParseResult.php';
require_once __DIR__ . '/../../src/Core/ComponentSchema.php';
require_once __DIR__ . '/../../src/WordPress/Adapters/WordPressImageAdapter.php';
require_once __DIR__ . '/../../src/WordPress/ValueAdapters.php';

if (!function_exists('wp_get_attachment_image_src')) {
   function wp_get_attachment_image_src(int $attachment_id, string $size): array|false
   {
      if ($attachment_id !== 42) {
         return false;
      }

      return [
         sprintf('https://example.test/%s/image.jpg', $size),
         1600,
         900,
         false,
      ];
   }
}

if (!function_exists('wp_get_attachment_image_srcset')) {
   function wp_get_attachment_image_srcset(int $attachment_id, string $size): string|false
   {
      return $attachment_id === 42
         ? 'image-800.jpg 800w, image-1600.jpg 1600w'
         : false;
   }
}

if (!function_exists('wp_get_attachment_image_sizes')) {
   function wp_get_attachment_image_sizes(int $attachment_id, string $size): string|false
   {
      return $attachment_id === 42
         ? '(min-width: 60rem) 50vw, 100vw'
         : false;
   }
}

if (!function_exists('get_post_meta')) {
   function get_post_meta(int $post_id, string $key, bool $single): mixed
   {
      return $post_id === 42 && $key === '_wp_attachment_image_alt'
         ? 'Attachment alt text'
         : '';
   }
}

/**
 * @throws RuntimeException
 */
function avenue_assert_same(
   mixed $expected,
   mixed $actual,
   string $message,
): void {
   if ($expected === $actual) {
      return;
   }

   throw new RuntimeException(
      sprintf(
         "%s\nExpected: %s\nActual: %s",
         $message,
         var_export($expected, true),
         var_export($actual, true),
      )
   );
}

/**
 * @param class-string<Throwable> $exception
 */
function avenue_assert_throws(
   callable $callback,
   string $exception,
   string $message,
): void {
   try {
      $callback();
   } catch (Throwable $thrown) {
      if ($thrown instanceof $exception) {
         return;
      }

      throw new RuntimeException(
         sprintf(
            '%s Expected %s; %s was thrown.',
            $message,
            $exception,
            $thrown::class,
         ),
         previous: $thrown,
      );
   }

   throw new RuntimeException(
      sprintf('%s Expected %s; nothing was thrown.', $message, $exception)
   );
}

ValueAdapters::boot();
ValueAdapters::boot();

avenue_assert_same(
   [
      'wordpress' => [
         'avenue/image' => AvenueUI\WordPress\Adapters\WordPressImageAdapter::class,
      ],
   ],
   AdapterRegistry::get_registered(),
   'Only genuine WordPress object-shape adapters should be registered.',
);

DefaultTransforms::boot();
DefaultTransforms::boot();

avenue_assert_same(
   [
      'boolean-map' => Avenue\ACF\BooleanMapTransform::class,
   ],
   TransformRegistry::get_registered(),
   'Default value transforms should register once.',
);

avenue_assert_same(
   '_blank',
   TransformRegistry::apply(
      1,
      [
         'type' => 'boolean-map',
         'true' => '_blank',
         'false' => '_self',
      ],
   ),
   'Boolean-map should translate a true ACF toggle.',
);

avenue_assert_same(
   '_self',
   TransformRegistry::apply(
      '0',
      [
         'type' => 'boolean-map',
         'true' => '_blank',
         'false' => '_self',
      ],
   ),
   'Boolean-map should translate a false ACF toggle.',
);

avenue_assert_throws(
   static fn() => TransformRegistry::apply(
      'sometimes',
      [
         'type' => 'boolean-map',
         'true' => '_blank',
         'false' => '_self',
      ],
   ),
   InvalidArgumentException::class,
   'Boolean-map should reject ambiguous source values.',
);

$transform_method = new ReflectionMethod(
   Avenue\ACF\BlockFactory::class,
   'transform_field_values',
);
$transform_method->setAccessible(true);

avenue_assert_same(
   [
      'link' => [
         'label' => 'About',
         'href' => '/about/',
         'target' => '_blank',
      ],
   ],
   $transform_method->invoke(
      null,
      [
         'field_definitions' => [
            [
               'name' => 'link',
               'type' => 'group',
               'sub_fields' => [
                  [
                     'name' => 'label',
                     'type' => 'text',
                  ],
                  [
                     'name' => 'href',
                     'type' => 'url',
                  ],
                  [
                     'name' => 'target',
                     'type' => 'true_false',
                     'avenue_transform' => [
                        'type' => 'boolean-map',
                        'true' => '_blank',
                        'false' => '_self',
                     ],
                  ],
               ],
            ],
         ],
      ],
      [
         'link' => [
            'label' => 'About',
            'href' => '/about/',
            'target' => 1,
         ],
      ],
   ),
   'BlockFactory should recursively apply transforms declared on nested ACF fields.',
);

$composite_field_definitions = [
   [
      'name' => 'section',
      'type' => 'group',
      'sub_fields' => [
         [
            'name' => 'appearance',
            'type' => 'select',
         ],
         [
            'name' => 'header',
            'type' => 'group',
            'sub_fields' => [
               [
                  'name' => 'heading',
                  'type' => 'text',
               ],
               [
                  'name' => 'buttons',
                  'type' => 'repeater',
                  'sub_fields' => [
                     [
                        'name' => 'label',
                        'type' => 'text',
                     ],
                  ],
               ],
            ],
         ],
         [
            'name' => 'footer',
            'type' => 'group',
            'sub_fields' => [
               [
                  'name' => 'outro',
                  'type' => 'textarea',
               ],
               [
                  'name' => 'buttons',
                  'type' => 'repeater',
                  'sub_fields' => [
                     [
                        'name' => 'label',
                        'type' => 'text',
                     ],
                  ],
               ],
            ],
         ],
      ],
   ],
   [
      'name' => 'cards',
      'type' => 'repeater',
      'sub_fields' => [
         [
            'name' => 'title',
            'type' => 'text',
         ],
         [
            'name' => 'text',
            'type' => 'textarea',
         ],
         [
            'name' => 'image',
            'type' => 'image',
         ],
         [
            'name' => 'link',
            'type' => 'group',
            'sub_fields' => [
               [
                  'name' => 'label',
                  'type' => 'text',
               ],
               [
                  'name' => 'href',
                  'type' => 'url',
               ],
               [
                  'name' => 'target',
                  'type' => 'true_false',
                  'avenue_transform' => [
                     'type' => 'boolean-map',
                     'true' => '_blank',
                     'false' => null,
                  ],
               ],
            ],
         ],
      ],
   ],
];

avenue_assert_same(
   [
      'cards' => [
         [
            'title' => 'Nested Card',
            'link' => [
               'label' => 'Read more',
               'href' => '/nested/',
               'target' => '_blank',
            ],
         ],
      ],
   ],
   $transform_method->invoke(
      null,
      [
         'field_definitions' => $composite_field_definitions,
      ],
      [
         'cards' => [
            [
               'title' => 'Nested Card',
               'link' => [
                  'label' => 'Read more',
                  'href' => '/nested/',
                  'target' => 1,
               ],
            ],
         ],
      ],
   ),
   'BlockFactory should apply transforms within every repeater row.',
);

avenue_assert_same(
   [
      'section' => [
         'appearance' => 'light',
         'header' => [
            'heading' => 'Featured Stories',
            'buttons' => [],
         ],
         'footer' => [
            'outro' => '',
            'buttons' => [],
         ],
      ],
      'cards' => [],
      'featured' => false,
   ],
   $transform_method->invoke(
      null,
      [
         'field_definitions' => [
            ...$composite_field_definitions,
            [
               'name' => 'featured',
               'type' => 'true_false',
            ],
         ],
      ],
      [
         'section' => [
            'appearance' => 'light',
            'header' => [
               'heading' => 'Featured Stories',
               'buttons' => false,
            ],
            'footer' => [
               'outro' => '',
               'buttons' => false,
            ],
         ],
         'cards' => false,
         'featured' => false,
      ],
   ),
   'Empty repeaters should normalize to arrays without changing Boolean fields.',
);

$merge_preview_method = new ReflectionMethod(
   Avenue\ACF\BlockFactory::class,
   'merge_preview_props',
);
$merge_preview_method->setAccessible(true);

avenue_assert_same(
   [
      'section' => [
         'appearance' => 'dark',
      ],
      'cards' => [
         [
            'title' => 'Preview Card',
         ],
      ],
      'featured' => false,
   ],
   $merge_preview_method->invoke(
      null,
      [
         'preview_props' => [
            'section' => [
               'appearance' => 'light',
            ],
            'cards' => [
               [
                  'title' => 'Preview Card',
               ],
            ],
            'featured' => true,
         ],
         'field_definitions' => [
            ...$composite_field_definitions,
            [
               'name' => 'featured',
               'type' => 'true_false',
            ],
         ],
      ],
      [
         'section' => [
            'appearance' => 'dark',
         ],
         'cards' => false,
         'featured' => false,
      ],
      true,
   ),
   'Empty structural fields should preserve preview data without swallowing primitive false values.',
);

final class AvenueAdapterCardFixture
{
   protected static string $schema =
      __DIR__ . '/../../src/components/card/card.schema.json';
}

final class AvenueAdapterCardSectionFixture
{
   protected static string $schema =
      __DIR__ . '/../../src/components/card-section/card-section.schema.json';
}

$adapt_method = new ReflectionMethod(
   Avenue\ACF\BlockFactory::class,
   'adapt_component_props',
);
$adapt_method->setAccessible(true);

avenue_assert_same(
   [
      'title' => 'Card',
      'link' => [
         'label' => 'About',
         'href' => '/about/',
      ],
      'image' => [
         'src' => 'https://example.test/card.jpg',
         'alt' => 'Card image',
         'width' => '1200',
         'height' => '675',
      ],
   ],
   $adapt_method->invoke(
      null,
      [
         'name' => 'card',
         'component' => AvenueAdapterCardFixture::class,
         'field_definitions' => [
            [
               'name' => 'image',
               'type' => 'image',
            ],
         ],
      ],
      [
         'title' => 'Card',
         'link' => [
            'label' => 'About',
            'href' => '/about/',
         ],
         'image' => [
            'url' => 'https://example.test/card.jpg',
            'alt' => 'Card image',
            'width' => 1200,
            'height' => 675,
         ],
      ],
      false,
      99,
   ),
   'BlockFactory should automatically adapt props with registered component contracts.',
);

avenue_assert_same(
   [
      'section' => [
         'appearance' => 'light',
      ],
      'cards' => [
         [
            'title' => 'Nested Card',
            'text' => '',
            'image' => [
               'src' => 'https://example.test/nested-card.jpg',
               'alt' => 'Nested Card image',
               'width' => '1200',
               'height' => '675',
            ],
            'link' => [
               'label' => 'Read more',
               'href' => '/nested/',
               'target' => '_blank',
            ],
         ],
      ],
   ],
   $adapt_method->invoke(
      null,
      [
         'name' => 'card-section',
         'component' => AvenueAdapterCardSectionFixture::class,
         'field_definitions' => $composite_field_definitions,
      ],
      [
         'section' => [
            'appearance' => 'light',
         ],
         'cards' => [
            [
               'title' => 'Nested Card',
               'text' => '',
               'image' => [
                  'url' => 'https://example.test/nested-card.jpg',
                  'alt' => 'Nested Card image',
                  'width' => 1200,
                  'height' => 675,
               ],
               'link' => [
                  'label' => 'Read more',
                  'href' => '/nested/',
                  'target' => '_blank',
               ],
            ],
         ],
      ],
      true,
      99,
   ),
   'BlockFactory should adapt source values inside array-item component contracts.',
);

$with_empty_nested_image = $adapt_method->invoke(
   null,
   [
      'name' => 'card-section',
      'component' => AvenueAdapterCardSectionFixture::class,
      'field_definitions' => $composite_field_definitions,
   ],
   [
      'section' => [
         'appearance' => 'light',
      ],
      'cards' => [
         [
            'title' => 'Nested Card',
            'image' => false,
         ],
      ],
   ],
   true,
   99,
);

avenue_assert_same(
   true,
   array_key_exists('image', $with_empty_nested_image['cards'][0]),
   'Nested adapters should retain explicitly adapted null values.',
);
avenue_assert_same(
   null,
   $with_empty_nested_image['cards'][0]['image'],
   'Nested adapters should normalize empty WordPress image values.',
);

$normalized_preview_fields = $transform_method->invoke(
   null,
   [
      'field_definitions' => $composite_field_definitions,
   ],
   [
      'section' => [
         'appearance' => 'light',
         'header' => [
            'heading' => 'Edited heading',
            'buttons' => false,
         ],
         'footer' => [
            'outro' => '',
            'buttons' => false,
         ],
      ],
      'cards' => false,
   ],
);
$merged_preview_props = $merge_preview_method->invoke(
   null,
   [
      'preview_props' => [
         'section' => [
            'header' => [
               'heading' => 'Featured Stories',
               'intro' => 'Preview introduction.',
            ],
         ],
         'cards' => [
            [
               'title' => 'Preview Card',
            ],
         ],
      ],
      'field_definitions' => $composite_field_definitions,
   ],
   $normalized_preview_fields,
   true,
);
$adapted_preview_props = $adapt_method->invoke(
   null,
   [
      'name' => 'card-section',
      'component' => AvenueAdapterCardSectionFixture::class,
      'field_definitions' => $composite_field_definitions,
   ],
   $merged_preview_props,
   true,
   99,
);
$card_section_preview = ComponentSchema::fromFile(
   __DIR__ . '/../../src/components/card-section/card-section.schema.json',
)->safeParse($adapted_preview_props);

avenue_assert_same(
   true,
   $card_section_preview->success(),
   'Edited Card Section previews should satisfy nested repeater contracts.',
);

$image_context = new AdapterContext(
   platform: 'wordpress',
   component: 'card',
   prop: 'image',
);

avenue_assert_same(
   [
      'src' => 'https://example.test/image.jpg',
      'alt' => 'An example',
      'width' => '1200',
      'height' => '675',
   ],
   AdapterRegistry::adapt(
      'avenue/image',
      [
         'url' => 'https://example.test/image.jpg',
         'alt' => 'An example',
         'width' => 1200,
         'height' => 675,
         // ACF's size-name map is not the HTML sizes attribute.
         'sizes' => [
            'thumbnail' => 'https://example.test/image-150.jpg',
         ],
      ],
      [],
      $image_context,
   ),
   'The Image adapter should normalize a complete ACF image array.',
);

avenue_assert_same(
   [
      'src' => 'https://example.test/large/image.jpg',
      'alt' => 'Attachment alt text',
      'srcset' => 'image-800.jpg 800w, image-1600.jpg 1600w',
      'sizes' => '(min-width: 60rem) 50vw, 100vw',
      'width' => '1600',
      'height' => '900',
   ],
   AdapterRegistry::adapt(
      'avenue/image',
      42,
      [],
      new AdapterContext(
         platform: 'wordpress',
         component: 'card',
         prop: 'image',
         options: [
            'image_size' => 'large',
         ],
      ),
   ),
   'The Image adapter should enrich attachment IDs through WordPress.',
);

avenue_assert_same(
   null,
   AdapterRegistry::adapt(
      'avenue/image',
      [
         'ID' => 404,
      ],
      [],
      $image_context,
   ),
   'An unresolved image without a URL should adapt to null.',
);

avenue_assert_throws(
   static fn() => AdapterRegistry::resolve(
      'wordpress',
      'avenue/unknown',
   ),
   LogicException::class,
   'Unknown contracts should fail resolution.',
);

fwrite(STDOUT, "Value adapter checks passed.\n");
