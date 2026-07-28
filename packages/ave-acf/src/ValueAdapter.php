<?php

declare(strict_types=1);

namespace Avenue\ACF;

interface ValueAdapter
{
   /**
    * Convert an integration value into a canonical component value.
    *
    * @param array<string, mixed> $definition Component prop definition.
    */
   public function adapt(
      mixed $value,
      array $definition,
      AdapterContext $context,
   ): mixed;
}
