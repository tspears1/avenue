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
      $definitions = $this->propDefinitions();

      foreach ($props as $name => $_value) {
         if (!array_key_exists($name, $definitions)) {
            throw $this->error(
               sprintf('Unknown prop "%s".', $name)
            );
         }
      }

      foreach ($definitions as $name => $definition) {
         if (
            !array_key_exists($name, $props) &&
            array_key_exists('default', $definition)
         ) {
            $props[$name] = $definition['default'];
         }

         $required = $definition['required'] ?? false;

         if (
            $required === true &&
            (
               !array_key_exists($name, $props) ||
               $props[$name] === null ||
               $props[$name] === ''
            )
         ) {
            throw $this->error(
               sprintf('Required prop "%s" is missing.', $name)
            );
         }

         if (
            !array_key_exists($name, $props) ||
            $props[$name] === null
         ) {
            continue;
         }

         $this->validateProp(
            $name,
            $props[$name],
            $definition,
         );
      }

      return $props;
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
   private function validateProp(
      string $name,
      mixed $value,
      array $definition,
   ): void {
      $type = $definition['type'] ?? null;

      if (
         is_string($type) &&
         !$this->matchesType($value, $type)
      ) {
         throw $this->error(
            sprintf(
               'Prop "%s" must be of type "%s"; %s given.',
               $name,
               $type,
               get_debug_type($value),
            )
         );
      }

      $enum = $definition['enum'] ?? null;

      if (
         is_array($enum) &&
         !in_array($value, $enum, true)
      ) {
         throw $this->error(
            sprintf(
               'Prop "%s" must be one of: %s.',
               $name,
               implode(', ', array_map('strval', $enum)),
            )
         );
      }
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
         default   => throw $this->error(
            sprintf('Unsupported schema type "%s".', $type)
         ),
      };
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

   private function error(string $message): InvalidArgumentException
   {
      return new InvalidArgumentException(
         sprintf('%s Schema: %s', $message, $this->path)
      );
   }
}