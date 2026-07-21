<?php

declare(strict_types=1);

namespace AvenueUI\Components;

use AvenueUI\Core\AvenueElement;

final class Image extends AvenueElement
{
   protected static string $name = 'image';

   protected static string $tag = 'ave-image';

   protected static string $schema = __DIR__ . '/image.schema.json';
}
