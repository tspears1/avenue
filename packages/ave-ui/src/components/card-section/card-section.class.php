<?php

declare(strict_types=1);

namespace AvenueUI\Components;

use AvenueUI\Core\AvenueElement;

final class CardSection extends AvenueElement
{
    protected static string $name = 'card-section';

    protected static string $tag = 'ave-card-section';

    protected static string $schema = __DIR__ . '/card-section.schema.json';
}
