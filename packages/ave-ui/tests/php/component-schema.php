<?php

declare(strict_types=1);

use AvenueUI\Core\ComponentSchema;

require_once __DIR__ . '/../../src/Core/AttributeRenderer.php';
require_once __DIR__ . '/../../src/Core/SchemaValidationIssue.php';
require_once __DIR__ . '/../../src/Core/SchemaParseResult.php';
require_once __DIR__ . '/../../src/Core/ComponentSchema.php';

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

$withDefaultLabel = $schema->safeParse([
   'title' => 'Card title',
   'link' => [
      'label' => '',
      'href' => '/learn-more/',
   ],
]);

avenue_schema_assert_same(
   true,
   $withDefaultLabel->success(),
   'Card should accept an empty contextual Button label.',
);
avenue_schema_assert_same(
   [
      'title' => 'Card title',
      'link' => [
         'label' => 'Learn More',
         'variant' => 'primary',
         'href' => '/learn-more/',
         'target' => '_self',
      ],
   ],
   $withDefaultLabel->data(),
   'Card should replace an empty Button label with its contextual default.',
);

$withMissingLabel = $schema->safeParse([
   'title' => 'Card title',
   'link' => [
      'href' => '/learn-more/',
   ],
]);

avenue_schema_assert_same(
   'Learn More',
   $withMissingLabel->data()['link']['label'] ?? null,
   'Card should apply its contextual Button label default when the label is absent.',
);

$buttonSchema = ComponentSchema::fromFile(
   __DIR__ . '/../../src/components/button/button.schema.json',
);
$standaloneButton = $buttonSchema->safeParse([
   'href' => '/learn-more/',
]);

avenue_schema_assert_same(
   false,
   $standaloneButton->success(),
   'Card contract overrides must not mutate the canonical Button schema.',
);
avenue_schema_assert_same(
   [
      [
         'path' => '$.label',
         'rule' => 'required',
      ],
   ],
   array_map(
      static fn($issue): array => [
         'path' => $issue->path,
         'rule' => $issue->rule,
      ],
      $standaloneButton->errors(),
   ),
   'Standalone Button should continue to require its canonical label.',
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

$withImage = $schema->safeParse([
   'title' => 'Card with image',
   'image' => [
      'src' => 'https://example.test/card.jpg',
      'alt' => 'Card image',
      'width' => '1200',
      'height' => '675',
   ],
]);

avenue_schema_assert_same(
   true,
   $withImage->success(),
   'A canonical Image value should satisfy Card’s Image contract.',
);
avenue_schema_assert_same(
   [
      'title' => 'Card with image',
      'image' => [
         'src' => 'https://example.test/card.jpg',
         'alt' => 'Card image',
         'height' => '675',
         'width' => '1200',
         'objectFit' => 'cover',
         'objectPosition' => 'center',
      ],
   ],
   $withImage->data(),
   'Nested Image defaults should come from the Image schema.',
);

$rejectedStructuralOverride = false;

try {
   ComponentSchema::fromFile(
      __DIR__ . '/fixtures/components/card/card.schema.json',
   );
} catch (RuntimeException $exception) {
   $rejectedStructuralOverride = str_contains(
      $exception->getMessage(),
      'unsupported rule "type"',
   );
}

avenue_schema_assert_same(
   true,
   $rejectedStructuralOverride,
   'Contract overrides should reject structural component rules.',
);

fwrite(STDOUT, "Component schema checks passed.\n");
