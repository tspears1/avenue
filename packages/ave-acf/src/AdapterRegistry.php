<?php

declare(strict_types=1);

namespace Avenue\ACF;

use InvalidArgumentException;
use LogicException;

/**
 * Resolves canonical component contracts to platform-specific value adapters.
 */
final class AdapterRegistry
{
   /**
    * @var array<string, array<string, ValueAdapter>>
    */
   private static array $adapters = [];

   public static function register(
      string $platform,
      string $contract,
      ValueAdapter $adapter,
   ): void {
      $platform = self::normalize_identifier($platform, 'platform');
      $contract = self::normalize_contract($contract);

      $registered = self::$adapters[$platform][$contract] ?? null;

      if ($registered !== null) {
         if ($registered::class === $adapter::class) {
            return;
         }

         throw new LogicException(
            sprintf(
               'Adapter "%s" is already registered for "%s" on "%s".',
               $registered::class,
               $contract,
               $platform,
            )
         );
      }

      self::$adapters[$platform][$contract] = $adapter;
   }

   public static function has(
      string $platform,
      string $contract,
   ): bool {
      $platform = self::normalize_identifier($platform, 'platform');
      $contract = self::normalize_contract($contract);

      return isset(self::$adapters[$platform][$contract]);
   }

   public static function resolve(
      string $platform,
      string $contract,
   ): ValueAdapter {
      $platform = self::normalize_identifier($platform, 'platform');
      $contract = self::normalize_contract($contract);

      $adapter = self::$adapters[$platform][$contract] ?? null;

      if ($adapter === null) {
         throw new LogicException(
            sprintf(
               'No adapter is registered for contract "%s" on "%s".',
               $contract,
               $platform,
            )
         );
      }

      return $adapter;
   }

   /**
    * @param array<string, mixed> $definition
    */
   public static function adapt(
      string $contract,
      mixed $value,
      array $definition,
      AdapterContext $context,
   ): mixed {
      return self::resolve(
         $context->platform,
         $contract,
      )->adapt(
         $value,
         $definition,
         $context,
      );
   }

   /**
    * @return array<string, array<string, string>>
    */
   public static function get_registered(): array
   {
      $registered = [];

      foreach (self::$adapters as $platform => $contracts) {
         foreach ($contracts as $contract => $adapter) {
            $registered[$platform][$contract] = $adapter::class;
         }
      }

      return $registered;
   }

   private static function normalize_contract(string $contract): string
   {
      $contract = strtolower(trim($contract));

      if (
         $contract === '' ||
         preg_match(
            '/^[a-z0-9][a-z0-9._-]*(?:\/[a-z0-9][a-z0-9._-]*)*$/',
            $contract,
         ) !== 1
      ) {
         throw new InvalidArgumentException(
            sprintf('Adapter contract "%s" is invalid.', $contract)
         );
      }

      return $contract;
   }

   private static function normalize_identifier(
      string $value,
      string $label,
   ): string {
      $value = strtolower(trim($value));

      if (
         $value === '' ||
         preg_match('/^[a-z0-9][a-z0-9._-]*$/', $value) !== 1
      ) {
         throw new InvalidArgumentException(
            sprintf(
               'Adapter %s "%s" is invalid.',
               $label,
               $value,
            )
         );
      }

      return $value;
   }
}
