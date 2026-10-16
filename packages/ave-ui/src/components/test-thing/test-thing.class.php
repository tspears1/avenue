<?php

declare(strict_types=1);

namespace AvenueUI\Components;

use AvenueUI\Core\AvenueElement;

final class TestThing extends AvenueElement
{
    protected static string $name = 'test-thing';

    protected static string $tag = 'ave-test-thing';

    protected static string $schema = __DIR__ . '/test-thing.schema.json';
}
