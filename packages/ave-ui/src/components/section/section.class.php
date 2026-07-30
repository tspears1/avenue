<?php

declare(strict_types=1);

namespace AvenueUI\Components;

use AvenueUI\Core\AvenueElement;

final class Section extends AvenueElement
{
    protected static string $name = 'section';

    protected static string $tag = 'ave-section';

    protected static string $schema = __DIR__ . '/section.schema.json';
}
