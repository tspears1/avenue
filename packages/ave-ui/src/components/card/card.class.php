<?php

declare(strict_types=1);

namespace AvenueUI\Components;

use AvenueUI\Core\AvenueElement;

final class Card extends AvenueElement
{
   protected static string $name = 'card';

   protected static string $tag = 'ave-card';

   protected static string $schema = __DIR__ . '/card.schema.json';
}
