<?php

declare(strict_types=1);

use Avenue\ACF\AdapterContext;
use Avenue\ACF\AdapterRegistry;
use Avenue\ACF\DefaultTransforms;
use Avenue\ACF\TransformRegistry;
use AvenueUI\WordPress\ValueAdapters;

require_once __DIR__ . '/../../../ave-acf/src/AdapterContext.php';
require_once __DIR__ . '/../../../ave-acf/src/ValueAdapter.php';
require_once __DIR__ . '/../../../ave-acf/src/AdapterRegistry.php';
require_once __DIR__ . '/../../../ave-acf/src/ValueTransform.php';
require_once __DIR__ . '/../../../ave-acf/src/TransformRegistry.php';
require_once __DIR__ . '/../../../ave-acf/src/BooleanMapTransform.php';
require_once __DIR__ . '/../../../ave-acf/src/DefaultTransforms.php';
require_once __DIR__ . '/../../../ave-acf/src/BlockFactory.php';
require_once __DIR__ . '/../../src/wordpress/adapters/WordPressImageAdapter.php';
require_once __DIR__ . '/../../src/wordpress/ValueAdapters.php';

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
