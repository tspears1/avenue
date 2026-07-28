<?php

declare(strict_types=1);

use AvenueUI\Components\Card;

require_once __DIR__ . '/../../src/wordpress/rendering/HtmlString.php';
require_once __DIR__ . '/../../src/wordpress/rendering/ClassNames.php';
require_once __DIR__ . '/../../src/wordpress/rendering/AttributeRenderer.php';
require_once __DIR__ . '/../../src/wordpress/rendering/SchemaValidationIssue.php';
require_once __DIR__ . '/../../src/wordpress/rendering/SchemaParseResult.php';
require_once __DIR__ . '/../../src/wordpress/rendering/ComponentSchema.php';
require_once __DIR__ . '/../../src/wordpress/rendering/AvenueElement.php';
require_once __DIR__ . '/../../src/components/card/card.class.php';

/**
 * @throws RuntimeException
 */
function avenue_transport_assert(
   bool $condition,
   string $message,
): void {
   if (!$condition) {
      throw new RuntimeException($message);
   }
}

/**
 * @param class-string<Throwable> $exception
 */
function avenue_transport_assert_throws(
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

/**
 * @return array<string, mixed>
 */
function avenue_transport_data_props(string $html): array
{
   if (
      preg_match(
         '/\\sdata-props="([^"]*)"/',
         $html,
         $matches,
      ) !== 1
   ) {
      throw new RuntimeException(
         sprintf('Rendered HTML has no data-props attribute: %s', $html)
      );
   }

   $json = html_entity_decode(
      $matches[1],
      ENT_QUOTES | ENT_HTML5,
      'UTF-8',
   );

   $value = json_decode(
      $json,
      true,
      flags: JSON_THROW_ON_ERROR,
   );

   if (!is_array($value)) {
      throw new RuntimeException('Decoded data-props must be an object.');
   }

   return $value;
}

$rendered = Card::render(
   props: [
      'title' => 'Research & teaching',
      'text' => 'A "quoted" summary',
      'link' => [
         'label' => 'Learn “more”',
         'variant' => 'secondary',
         'href' => '/about/',
         'target' => '_blank',
      ],
      'image' => null,
   ],
   attrs: [
      'id' => 'featured-card',
   ],
   classes: [
      'highlight',
   ],
);

avenue_transport_assert(
   str_contains($rendered, ' title="Research &amp; teaching"'),
   'Primitive props should render as individual HTML attributes.',
);
avenue_transport_assert(
   str_contains($rendered, ' text="A &quot;quoted&quot; summary"'),
   'Primitive attribute values should be escaped.',
);
avenue_transport_assert(
   !str_contains($rendered, ' link="'),
   'Property-transport props must not render as individual attributes.',
);
avenue_transport_assert(
   !str_contains($rendered, ' image="'),
   'Null property-transport props must be omitted.',
);
avenue_transport_assert(
   str_contains($rendered, ' id="featured-card"'),
   'Caller-supplied non-reserved attributes should be preserved.',
);
avenue_transport_assert(
   str_contains($rendered, ' class="highlight"'),
   'Classes should remain compatible with transport rendering.',
);

avenue_transport_assert(
   [
      'link' => [
         'label' => 'Learn “more”',
         'variant' => 'secondary',
         'href' => '/about/',
         'target' => '_blank',
      ],
   ] === avenue_transport_data_props($rendered),
   'Complex props should survive JSON and HTML attribute escaping.',
);

$withoutProperties = Card::render(
   props: [
      'title' => 'No action',
      'image' => null,
   ],
);

avenue_transport_assert(
   !str_contains($withoutProperties, ' data-props='),
   'An empty property payload should omit data-props.',
);

$withEmptyArray = Card::render(
   props: [
      'title' => 'Empty image data',
      'image' => [],
   ],
);

avenue_transport_assert(
   ['image' => []] === avenue_transport_data_props($withEmptyArray),
   'Intentional empty arrays should survive property transport.',
);

avenue_transport_assert_throws(
   static fn(): string => Card::render(
      props: [
         'title' => 'Collision',
      ],
      attrs: [
         'data-props' => '{"link":{}}',
      ],
   ),
   InvalidArgumentException::class,
   'Callers must not supply the reserved data-props attribute.',
);

avenue_transport_assert_throws(
   static fn(): string => Card::render(
      props: [
         'title' => 'Invalid encoding',
         'link' => [
            'label' => "\xB1\x31",
            'href' => '/about/',
         ],
      ],
   ),
   InvalidArgumentException::class,
   'Invalid JSON values should fail component rendering.',
);

fwrite(STDOUT, "Component transport checks passed.\n");
