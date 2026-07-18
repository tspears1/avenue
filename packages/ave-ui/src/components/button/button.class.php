<?php

declare(strict_types=1);

namespace AvenueUI\Components;

use AvenueUI\Core\AvenueElement;

final class Button extends AvenueElement
{
   protected static string $name = 'button';

   protected static string $tag = 'ave-button';

   protected static string $schema = __DIR__ . '/button.schema.json';
}