<?php

declare(strict_types=1);

namespace Avenue\ACF;

use InvalidArgumentException;
use LogicException;

/**
 * Registry for small reusable source-value transformations.
 */
final class TransformRegistry
{
   /**
    * @var array<string, ValueTransform>
    */
   private static array $transforms = [];

   public static function register(
      string $name,
      ValueTransform $transform,
   ): void {
      $name = self::normalize_name($name);
      $registered = self::$transforms[$name] ?? null;

      if ($registered !== null) {
         if ($registered::class === $transform::class) {
            return;
         }

         throw new LogicException(
            sprintf(
               'Transform "%s" is already registered as "%s".',
               $registered::class,
               $name,
            )
         );
      }

      self::$transforms[$name] = $transform;
   }

   public static function has(string $name): bool
   {
      return isset(self::$transforms[self::normalize_name($name)]);
   }

   public static function resolve(string $name): ValueTransform
   {
      $name = self::normalize_name($name);
      $transform = self::$transforms[$name] ?? null;

      if ($transform === null) {
         throw new LogicException(
            sprintf('No value transform is registered as "%s".', $name)
         );
      }

      return $transform;
   }

   /**
    * Apply a field's `avenue_transform` declaration.
    *
    * @param array<string, mixed> $definition
    */
   public static function apply(
      mixed $value,
      array $definition,
   ): mixed {
      $type = $definition['type'] ?? null;

      if (!is_string($type) || $type === '') {
         throw new InvalidArgumentException(
            'A value transform declaration requires a non-empty "type".'
         );
      }

      $options = $definition;
      unset($options['type']);

      return self::resolve($type)->transform(
         $value,
         $options,
      );
   }

   /**
    * @return array<string, string>
    */
   public static function get_registered(): array
   {
      $registered = [];

      foreach (self::$transforms as $name => $transform) {
         $registered[$name] = $transform::class;
      }

      return $registered;
   }

   private static function normalize_name(string $name): string
   {
      $name = strtolower(trim($name));

      if (
         $name === '' ||
         preg_match('/^[a-z0-9][a-z0-9._-]*$/', $name) !== 1
      ) {
         throw new InvalidArgumentException(
            sprintf('Value transform name "%s" is invalid.', $name)
         );
      }

      return $name;
   }
}
