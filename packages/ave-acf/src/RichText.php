<?php

declare(strict_types=1);

namespace Avenue\ACF;

final class RichText
{
   /**
    * Create a serializable rich-text value.
    *
    * @return array{
    *     format: 'html',
    *     value: string
    * }
    */
   public static function from_html(string $content): array
   {
      return [
         'format' => 'html',
         'value'  => wp_kses_post($content),
      ];
   }
}
