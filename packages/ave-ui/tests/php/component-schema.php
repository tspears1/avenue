<?php

declare(strict_types=1);

use AvenueUI\Core\ComponentSchema;

require_once __DIR__ . '/../../src/wordpress/rendering/AttributeRenderer.php';
require_once __DIR__ . '/../../src/wordpress/rendering/SchemaValidationIssue.php';
require_once __DIR__ . '/../../src/wordpress/rendering/SchemaParseResult.php';
require_once __DIR__ . '/../../src/wordpress/rendering/ComponentSchema.php';

/**
 * @throws RuntimeException
 */
function avenue_schema_assert_same(
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

$schema = ComponentSchema::fromFile(
   __DIR__ . '/../../src/components/card/card.schema.json',
);

$valid = $schema->safeParse([
   'title' => 'Card title',
   'link' => [
      'label' => 'Read more',
      'href' => '/about/',
   ],
   'image' => null,
]);

avenue_schema_assert_same(
   true,
   $valid->success(),
   'A Card should recursively satisfy its Button contract.',
);

avenue_schema_assert_same(
   [
      'title' => 'Card title',
      'link' => [
         'label' => 'Read more',
         'variant' => 'primary',
         'href' => '/about/',
         'target' => '_self',
      ],
      'image' => null,
   ],
   $valid->data(),
   'Nested Button defaults should come from the Button schema.',
);

avenue_schema_assert_same(
   [
      'attributes' => [
         'title' => 'Card title',
      ],
      'properties' => [
         'link' => [
            'label' => 'Read more',
            'variant' => 'primary',
            'href' => '/about/',
            'target' => '_self',
         ],
      ],
   ],
   $schema->partitionProps($valid->data()),
   'Schema transport should separate primitive attributes from structured properties.',
);

$invalid = $schema->safeParse([
   'title' => 'Card title',
   'link' => [
      'label' => 'Read more',
      'href' => '/about/',
      'target' => 'popup',
      'unexpected' => true,
   ],
]);

avenue_schema_assert_same(
   false,
   $invalid->success(),
   'Invalid nested Button props should fail safe parsing.',
);

avenue_schema_assert_same(
   [
      [
         'path' => '$.link.unexpected',
         'rule' => 'unknown',
      ],
      [
         'path' => '$.link.target',
         'rule' => 'enum',
      ],
   ],
   array_map(
      static fn($issue): array => [
         'path' => $issue->path,
         'rule' => $issue->rule,
      ],
      $invalid->errors(),
   ),
   'Nested schema issues should retain precise paths and rules.',
);

fwrite(STDOUT, "Component schema checks passed.\n");
