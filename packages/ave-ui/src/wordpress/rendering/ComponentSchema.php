<?php

declare(strict_types=1);

namespace AvenueUI\Core;

use InvalidArgumentException;
use JsonException;
use RuntimeException;

final class ComponentSchema
{
   /**
    * @var array<string, self>
    */
   private static array $cache = [];

   /**
    * @param array<string, mixed> $schema
    */
   private function __construct(
      private readonly array $schema,
      private readonly string $path,
   ) {
      $this->validateSchema();
   }

   public static function fromFile(string $path): self
   {
      $resolvedPath = realpath($path);

      if ($resolvedPath === false || !is_file($resolvedPath)) {
         throw new RuntimeException(
            sprintf('Component schema not found: %s.', $path)
         );
      }

      if (isset(self::$cache[$resolvedPath])) {
         return self::$cache[$resolvedPath];
      }

      $contents = file_get_contents($resolvedPath);

      if ($contents === false) {
         throw new RuntimeException(
            sprintf('Unable to read component schema: %s.', $resolvedPath)
         );
      }

      try {
         $schema = json_decode(
            $contents,
            true,
            flags: JSON_THROW_ON_ERROR,
         );
      } catch (JsonException $exception) {
         throw new RuntimeException(
            sprintf('Invalid JSON schema: %s.', $resolvedPath),
            previous: $exception,
         );
      }

      if (!is_array($schema)) {
         throw new RuntimeException(
            sprintf('Component schema must contain an object: %s.', $resolvedPath)
         );
      }

      return self::$cache[$resolvedPath] = new self(
         $schema,
         $resolvedPath,
      );
   }

   /**
    * Apply defaults and validate component props.
    *
    * @param array<string, mixed> $props
    *
    * @return array<string, mixed>
    */
   public function prepareProps(array $props): array
   {
      return $this->parse($props);
   }

   /**
    * Strictly parse component props and throw when validation fails.
    *
    * @param array<string, mixed> $props
    * @return array<string, mixed>
    */
   public function parse(array $props): array
   {
      $result = $this->safeParse($props);

      if ($result->success()) {
         return $result->data();
      }

      $messages = array_map(
         static fn(
            SchemaValidationIssue $issue
         ): string => sprintf(
            '%s: %s',
            $issue->path,
            $issue->message,
         ),
         $result->errors(),
      );

      throw $this->error(implode(' ', $messages));
   }

   /**
    * Parse component props without throwing for value validation failures.
    *
    * @param array<string, mixed> $props
    */
   public function safeParse(array $props): SchemaParseResult
   {
      $errors = [];
      $data = $this->parseObject(
         $props,
         $this->propDefinitions(),
         '$',
         $errors,
      );

      return new SchemaParseResult(
         $data,
         $errors,
      );
   }

   /**
    * Partition prepared props according to their schema transport.
    *
    * Property-transport nulls are omitted so an absent optional object does
    * not create an otherwise empty data-props payload.
    *
    * @param array<string, mixed> $props
    * @return array{
    *    attributes: array<string, mixed>,
    *    properties: array<string, mixed>
    * }
    */
   public function partitionProps(array $props): array
   {
      $definitions = $this->propDefinitions();
      $attributes = [];
      $properties = [];

      foreach ($props as $name => $value) {
         $definition = $definitions[$name] ?? null;

         if (!is_array($definition)) {
            throw $this->error(
               sprintf('Unknown prop "%s".', $name)
            );
         }

         if (($definition['transport'] ?? 'attribute') === 'property') {
            if ($value !== null) {
               $properties[$name] = $value;
            }

            continue;
         }

         $attribute = $definition['attribute'] ?? $name;
         $attributeName = is_string($attribute)
            ? $attribute
            : $name;

         $attributes[$attributeName] = $value;
      }

      return [
         'attributes' => $attributes,
         'properties' => $properties,
      ];
   }

   /**
    * @param array<string, mixed> $attrs
    */
   public function validateAttributes(array $attrs): void
   {
      foreach (array_keys($attrs) as $name) {
         if (
            !is_string($name) ||
            !AttributeRenderer::isValidName($name)
         ) {
            throw $this->error(
               sprintf('Invalid attribute name "%s".', (string) $name)
            );
         }

         if (strtolower($name) === 'data-props') {
            throw $this->error(
               'Attribute "data-props" is reserved for schema-driven property transport.'
            );
         }
      }
   }

   /**
    * @param array<string, mixed> $slots
    */
   public function validateSlots(array $slots): void
   {
      $definitions = $this->slotDefinitions();

      foreach ($slots as $name => $_content) {
         if (!array_key_exists($name, $definitions)) {
            throw $this->error(
               sprintf('Unknown slot "%s".', $name)
            );
         }
      }

      foreach ($definitions as $name => $definition) {
         $optional = $definition['optional'] ?? true;

         if (
            $optional === false &&
            (
               !array_key_exists($name, $slots) ||
               $slots[$name] === null ||
               $slots[$name] === ''
            )
         ) {
            throw $this->error(
               sprintf('Required slot "%s" is missing.', $name)
            );
         }
      }
   }

   /**
    * @param array<string, mixed> $definition
    */
   private function parseValue(
      mixed $value,
      array $definition,
      string $path,
      array &$errors,
   ): mixed {
      $type = $definition['type'] ?? null;

      if (
         is_string($type) &&
         !$this->matchesType($value, $type)
      ) {
         $errors[] = new SchemaValidationIssue(
            path: $path,
            rule: 'type',
            message: sprintf(
               'Expected type "%s"; %s given.',
               $type,
               get_debug_type($value),
            ),
            expected: $type,
            received: get_debug_type($value),
         );

         return $value;
      }

      $enum = $definition['enum'] ?? null;

      if (
         is_array($enum) &&
         !in_array($value, $enum, true)
      ) {
         $errors[] = new SchemaValidationIssue(
            path: $path,
            rule: 'enum',
            message: sprintf(
               'Expected one of: %s.',
               implode(', ', array_map('strval', $enum)),
            ),
            expected: $enum,
            received: $value,
         );
      }

      $contract = $definition['contract'] ?? null;

      if (is_array($contract)) {
         $component = $contract['component'] ?? null;

         if (is_string($component) && is_array($value)) {
            $contractSchema = $this->resolveComponentContract(
               $component,
            );
            $result = $contractSchema->safeParse($value);

            foreach ($result->errors() as $issue) {
               $errors[] = new SchemaValidationIssue(
                  path: $path . substr($issue->path, 1),
                  rule: $issue->rule,
                  message: $issue->message,
                  expected: $issue->expected,
                  received: $issue->received,
               );
            }

            return $result->data();
         }
      }

      $properties = $definition['properties'] ?? null;

      if (is_array($properties) && is_array($value)) {
         return $this->parseObject(
            $value,
            $properties,
            $path,
            $errors,
         );
      }

      $items = $definition['items'] ?? null;

      if (
         ($definition['type'] ?? null) === 'array' &&
         is_array($items) &&
         is_array($value)
      ) {
         foreach ($value as $index => $item) {
            $value[$index] = $this->parseValue(
               $item,
               $items,
               sprintf('%s[%s]', $path, (string) $index),
               $errors,
            );
         }
      }

      return $value;
   }

   private function matchesType(mixed $value, string $type): bool
   {
      return match ($type) {
         'string'  => is_string($value),
         'boolean' => is_bool($value),
         'integer' => is_int($value),
         'number'  => is_int($value) || is_float($value),
         'array'   => is_array($value),
         'object'  => is_object($value) || is_array($value),
         default   => false,
      };
   }

   /**
    * @param array<string, mixed> $value
    * @param array<string, array<string, mixed>> $definitions
    * @param list<SchemaValidationIssue> $errors
    * @return array<string, mixed>
    */
   private function parseObject(
      array $value,
      array $definitions,
      string $path,
      array &$errors,
   ): array {
      foreach ($value as $name => $_item) {
         if (
            !is_string($name) ||
            !array_key_exists($name, $definitions)
         ) {
            $propPath = is_string($name)
               ? $path . '.' . $name
               : $path;

            $errors[] = new SchemaValidationIssue(
               path: $propPath,
               rule: 'unknown',
               message: sprintf(
                  'Unknown property "%s".',
                  (string) $name,
               ),
               received: $name,
            );
         }
      }

      $parsed = [];

      foreach ($definitions as $name => $definition) {
         if (!is_array($definition)) {
            continue;
         }

         $propPath = $path . '.' . $name;
         $exists = array_key_exists($name, $value);

         if (!$exists && array_key_exists('default', $definition)) {
            $value[$name] = $definition['default'];
            $exists = true;
         }

         if (
            ($definition['required'] ?? false) === true &&
            (
               !$exists ||
               $value[$name] === null ||
               $value[$name] === ''
            )
         ) {
            $errors[] = new SchemaValidationIssue(
               path: $propPath,
               rule: 'required',
               message: 'Required value is missing.',
               expected: 'non-empty value',
               received: $exists ? $value[$name] : null,
            );
         }

         if (!$exists) {
            continue;
         }

         if ($value[$name] === null) {
            $parsed[$name] = null;
            continue;
         }

         $parsed[$name] = $this->parseValue(
            $value[$name],
            $definition,
            $propPath,
            $errors,
         );
      }

      return $parsed;
   }

   private function resolveComponentContract(
      string $component,
   ): self {
      if (
         preg_match('/^[a-z0-9][a-z0-9-]*$/', $component) !== 1
      ) {
         throw new RuntimeException(
            sprintf(
               'Invalid component contract "%s" in schema: %s.',
               $component,
               $this->path,
            )
         );
      }

      $componentsPath = dirname(dirname($this->path));
      $contractPath = sprintf(
         '%s/%s/%s.schema.json',
         $componentsPath,
         $component,
         $component,
      );

      return self::fromFile($contractPath);
   }

   /**
    * @return array<string, array<string, mixed>>
    */
   private function propDefinitions(): array
   {
      $definitions = $this->schema['props']['root'] ?? [];

      return is_array($definitions) ? $definitions : [];
   }

   /**
    * @return array<string, array<string, mixed>>
    */
   private function slotDefinitions(): array
   {
      $definitions = $this->schema['slots']['root'] ?? [];

      return is_array($definitions) ? $definitions : [];
   }

   private function validateSchema(): void
   {
      foreach ($this->propDefinitions() as $name => $definition) {
         if (!is_array($definition)) {
            throw new RuntimeException(
               sprintf(
                  'Prop definition "%s" must be an object. Schema: %s',
                  $name,
                  $this->path,
               )
            );
         }

         if ($name === 'serializedProps') {
            throw new RuntimeException(
               sprintf(
                  'Prop name "serializedProps" is reserved. Schema: %s',
                  $this->path,
               )
            );
         }

         $transport = $definition['transport'] ?? null;
         $attribute = $definition['attribute'] ?? null;
         $type = $definition['type'] ?? null;

         if (
            $transport !== null &&
            !in_array($transport, ['attribute', 'property'], true)
         ) {
            throw new RuntimeException(
               sprintf(
                  'Prop "%s" contains unsupported transport "%s". Schema: %s',
                  $name,
                  (string) $transport,
                  $this->path,
               )
            );
         }

         if (
            $transport === 'property' &&
            $attribute !== false
         ) {
            throw new RuntimeException(
               sprintf(
                  'Property-transport prop "%s" must declare attribute:false. Schema: %s',
                  $name,
                  $this->path,
               )
            );
         }

         if (
            $attribute === false &&
            $transport !== 'property'
         ) {
            throw new RuntimeException(
               sprintf(
                  'Prop "%s" with attribute:false must use property transport. Schema: %s',
                  $name,
                  $this->path,
               )
            );
         }

         if (
            in_array($type, ['object', 'array'], true) &&
            $transport !== 'property'
         ) {
            throw new RuntimeException(
               sprintf(
                  'Structured prop "%s" must use property transport. Schema: %s',
                  $name,
                  $this->path,
               )
            );
         }

         if (
            $transport === 'property' &&
            !in_array($type, ['object', 'array'], true)
         ) {
            throw new RuntimeException(
               sprintf(
                  'Property-transport prop "%s" must have type "object" or "array". Schema: %s',
                  $name,
                  $this->path,
               )
            );
         }

         if (
            $attribute !== null &&
            !is_string($attribute) &&
            !is_bool($attribute)
         ) {
            throw new RuntimeException(
               sprintf(
                  'Prop "%s" attribute must be a string or boolean. Schema: %s',
                  $name,
                  $this->path,
               )
            );
         }

         if ($transport !== 'property') {
            $attributeName = is_string($attribute)
               ? $attribute
               : $name;

            if (!AttributeRenderer::isValidName($attributeName)) {
               throw new RuntimeException(
                  sprintf(
                     'Prop "%s" resolves to invalid attribute name "%s". Schema: %s',
                     $name,
                     $attributeName,
                     $this->path,
                  )
               );
            }

            if (strtolower($attributeName) === 'data-props') {
               throw new RuntimeException(
                  sprintf(
                     'Attribute name "data-props" is reserved. Schema: %s',
                     $this->path,
                  )
               );
            }
         }

         $contract = $definition['contract'] ?? null;

         if (
            $contract !== null &&
            (
               !is_array($contract) ||
               !isset($contract['component']) ||
               !is_string($contract['component']) ||
               $contract['component'] === ''
            )
         ) {
            throw new RuntimeException(
               sprintf(
                  'Prop "%s" contains an invalid component contract. Schema: %s',
                  $name,
                  $this->path,
               )
            );
         }

         if ($contract !== null && $type !== 'object') {
            throw new RuntimeException(
               sprintf(
                  'Contract prop "%s" must have type "object". Schema: %s',
                  $name,
                  $this->path,
               )
            );
         }
      }
   }

   private function error(string $message): InvalidArgumentException
   {
      return new InvalidArgumentException(
         sprintf('%s Schema: %s', $message, $this->path)
      );
   }
}
