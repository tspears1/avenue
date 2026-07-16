<?php

declare(strict_types=1);

namespace Avenue\ACF;

final class Fields
{
   /**
    * Safe wrapper around get_field with optional default fallback.
    *
    * @param string $selector Field selector/name.
    * @param mixed $post_id Post ID/context passed to ACF.
    * @param bool $format_value Whether to format the value.
    * @param bool $escape_html Whether to escape html in output.
    * @param mixed $default Fallback value when field is unavailable/null.
    * @return mixed
    */
   public static function get(
      string $selector,
      $post_id = false,
      bool $format_value = true,
      bool $escape_html = false,
      $default = null,
   ) {
      if (!function_exists('get_field')) {
         return $default;
      }

      $value = get_field($selector, $post_id, $format_value, $escape_html);

      return $value !== null ? $value : $default;
   }

   /**
    * Safe wrapper around get_sub_field with optional default fallback.
    *
    * @param string $selector Sub field selector/name.
    * @param bool $format_value Whether to format the value.
    * @param bool $escape_html Whether to escape html in output.
    * @param mixed $default Fallback value when field is unavailable/null.
    * @return mixed
    */
   public static function get_sub(
      string $selector,
      bool $format_value = true,
      bool $escape_html = false,
      $default = null,
   ) {
      if (!function_exists('get_sub_field')) {
         return $default;
      }

      $value = get_sub_field($selector, $format_value, $escape_html);

      return $value !== null ? $value : $default;
   }

   /**
    * Flatten ACF clone field data.
    *
    * When using clone fields with seamless display and prefix_name: 0,
    * ACF wraps the cloned fields in a nested array. This method flattens that structure.
    *
    * @param array<string, mixed> $data Field data.
    * @param string|null $clone_key Specific clone wrapper key, or null to auto-detect.
    * @return array<string, mixed> Flattened data.
    */
   public static function flatten_clone(array $data, ?string $clone_key = null): array
   {
      if (empty($data)) {
         return $data;
      }

      // Auto-detect clone wrapper key
      if ($clone_key === null) {
         $possible_keys = array_filter(
            array_keys($data),
            fn($k) => str_ends_with($k, '_fields')
         );

         if (count($possible_keys) === 1) {
            $clone_key = reset($possible_keys);
         }
      }

      // If clone key exists and contains data, return nested data
      if ($clone_key !== null && isset($data[$clone_key]) && is_array($data[$clone_key])) {
         return $data[$clone_key];
      }

      // Otherwise return data as-is
      return $data;
   }

   /**
    * Get image data in consistent format.
    *
    * Normalizes ACF image field data regardless of return format.
    *
    * @param mixed $image Image field value (array, ID, or URL).
    * @param string $size Image size.
    * @return array<string, mixed>|null Image data array or null.
    */
   public static function get_image($image, string $size = 'full'): ?array
   {
      // Already an array (ACF array return format)
      if (is_array($image)) {
         return [
            'id' => $image['ID'] ?? null,
            'url' => $image['url'] ?? '',
            'alt' => $image['alt'] ?? '',
            'width' => $image['width'] ?? null,
            'height' => $image['height'] ?? null,
            'title' => $image['title'] ?? '',
            'caption' => $image['caption'] ?? '',
         ];
      }

      // Image ID (ACF ID return format)
      if (is_numeric($image)) {
         $attachment = wp_get_attachment_image_src($image, $size);

         if (!$attachment) {
            return null;
         }

         return [
            'id' => (int) $image,
            'url' => $attachment[0],
            'width' => $attachment[1],
            'height' => $attachment[2],
            'alt' => get_post_meta($image, '_wp_attachment_image_alt', true),
            'title' => get_the_title($image),
            'caption' => wp_get_attachment_caption($image),
         ];
      }

      // URL string (ACF URL return format)
      if (is_string($image) && filter_var($image, FILTER_VALIDATE_URL)) {
         return [
            'id' => null,
            'url' => $image,
            'alt' => '',
            'width' => null,
            'height' => null,
            'title' => '',
            'caption' => '',
         ];
      }

      return null;
   }

   /**
    * Get repeater field as array.
    *
    * Ensures repeater data is always an array (even if empty).
    *
    * @param mixed $repeater Repeater field value.
    * @return array<int, mixed> Repeater rows.
    */
   public static function get_repeater($repeater): array
   {
      if (!is_array($repeater)) {
         return [];
      }

      return $repeater;
   }

   /**
    * Check if repeater has rows.
    *
    * @param mixed $repeater Repeater field value.
    * @return bool True if repeater has rows.
    */
   public static function has_repeater($repeater): bool
   {
      return is_array($repeater) && count($repeater) > 0;
   }

   /**
    * Get link field data.
    *
    * Normalizes ACF link field data.
    *
    * @param mixed $link Link field value.
    * @return array<string, string>|null Link data array or null.
    */
   public static function get_link($link): ?array
   {
      if (!is_array($link)) {
         return null;
      }

      return [
         'url' => $link['url'] ?? '',
         'title' => $link['title'] ?? '',
         'target' => $link['target'] ?? '_self',
      ];
   }

   /**
    * Get true/false field as boolean.
    *
    * Handles ACF true_false field quirks (can return 1, '1', true, 'true', etc.).
    *
    * @param mixed $value True/false field value.
    * @return bool Boolean value.
    */
   public static function get_bool($value): bool
   {
      return $value === 1
         || $value === '1'
         || $value === true
         || $value === 'true';
   }

   /**
    * Get relationship field posts.
    *
    * Ensures relationship field returns WP_Post objects.
    *
    * @param mixed $relationship Relationship field value.
    * @return array<int, \WP_Post> Array of WP_Post objects.
    */
   public static function get_relationship($relationship): array
   {
      if (!is_array($relationship)) {
         return [];
      }

      // Filter out non-post objects
      return array_filter($relationship, function ($item) {
         return $item instanceof \WP_Post;
      });
   }

   /**
    * Get taxonomy terms from field.
    *
    * Ensures taxonomy field returns WP_Term objects.
    *
    * @param mixed $terms Taxonomy field value.
    * @return array<int, \WP_Term> Array of WP_Term objects.
    */
   public static function get_taxonomy($terms): array
   {
      if (!is_array($terms)) {
         return [];
      }

      // Filter out non-term objects
      return array_filter($terms, function ($item) {
         return $item instanceof \WP_Term;
      });
   }
}
