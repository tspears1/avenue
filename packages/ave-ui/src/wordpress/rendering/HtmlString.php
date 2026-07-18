<?php

declare(strict_types=1);

namespace AvenueUI\Core;

use Stringable;

final readonly class HtmlString implements Stringable
{
   public function __construct(
      private string $value,
   ) {
   }

   public function value(): string
   {
      return $this->value;
   }

   public function __toString(): string
   {
      return $this->value;
   }
}