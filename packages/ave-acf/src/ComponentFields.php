<?php

declare(strict_types=1);

namespace Avenue\ACF;

abstract class ComponentFields
{
   /**
    * Component slug used for field and group keys.
    */
   abstract protected static function component_name(): string;

   /**
    * Define the component's canonical fields.
    *
    * No selection, overrides, or consumer-specific keys should happen here.
    *
    * @return array<int, array<string, mixed>>
    */
   abstract protected static function define_fields(): array;

   /**
    * Default field group configuration.
    *
    * @return array<string, mixed>
    */
   protected static function field_group_config(): array
   {
      return [
         'location' => [],
         'style' => 'seamless',
         'wrap' => false,
      ];
   }

   /**
    * Get this component's field definitions.
    *
    * @param array<string, array<string, mixed>> $overrides
    * @param array<int, string>|null $include
    * @param array<int, string> $exclude
    * @return array<int, array<string, mixed>>
    */
   public static function get_fields(
      array $overrides = [],
      ?array $include = null,
      array $exclude = [],
   ): array {
      $fields = FieldBuilder::select_fields(
         fields: static::define_fields(),
         include: $include,
         exclude: $exclude,
      );

      return FieldBuilder::override_fields(
         fields: $fields,
         overrides: $overrides,
      );
   }

   /**
    * Get fields materialized for another component.
    *
    * @param string $consumer_component
    * @param array<string, array<string, mixed>> $overrides
    * @param array<int, string>|null $include
    * @param array<int, string> $exclude
    * @param string|null $namespace
    * @return array<int, array<string, mixed>>
    */
   public static function materialize(
      string $consumer_component,
      array $overrides = [],
      ?array $include = null,
      array $exclude = [],
      ?string $namespace = null,
   ): array {
      return FieldBuilder::materialize_fields(
         component_name: $consumer_component,
         fields: static::get_fields(
            include: $include,
            exclude: $exclude,
         ),
         overrides: $overrides,
         namespace: $namespace,
      );
   }

   /**
    * Get the complete ACF field group.
    *
    * @param array<string, mixed> $config
    * @param array<string, array<string, mixed>> $overrides
    * @param array<int, string>|null $include
    * @param array<int, string> $exclude
    * @return array<string, mixed>
    */
   public static function get_field_group(
      array $config = [],
      array $overrides = [],
      ?array $include = null,
      array $exclude = [],
   ): array {
      return FieldBuilder::build_field_group(
         static::component_name(),
         static::get_fields(
            overrides: $overrides,
            include: $include,
            exclude: $exclude,
         ),
         array_replace(
            static::field_group_config(),
            $config,
         ),
      );
   }

   /**
    * Register the component's canonical field group.
    *
    * @param array<string, mixed> $config
    * @param array<string, array<string, mixed>> $overrides
    */
   public static function register(
      array $config = [],
      array $overrides = [],
   ): bool {
      return FieldBuilder::register_field_group(
         static::get_field_group(
            config: $config,
            overrides: $overrides,
         ),
      );
   }

   public static function get_component_name(): string
   {
      return static::component_name();
   }

   public static function get_group_key(): string
   {
      return FieldBuilder::build_group_key(
         static::component_name(),
         'component',
      );
   }

   public static function get_field_key(string $field_name): string
   {
      return FieldBuilder::build_field_key(
         static::component_name(),
         $field_name,
      );
   }
}