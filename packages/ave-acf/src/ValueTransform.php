<?php

declare(strict_types=1);

namespace Avenue\ACF;

interface ValueTransform
{
   /**
    * @param array<string, mixed> $options
    */
   public function transform(
      mixed $value,
      array $options,
   ): mixed;
}
