<?php

declare(strict_types=1);

namespace AvenueUI\Core;

use Stringable;

final readonly class HtmlString implements Stringable
{
    /**
     * Create a trusted HTML value.
     *
     * @param string $value Trusted HTML markup.
     */
    public function __construct(
        private string $value,
    ) {
    }

    /**
     * Return the trusted HTML markup.
     *
     * @return string Trusted HTML markup.
     */
    public function value(): string
    {
        return $this->value;
    }

    /**
     * Convert the value to its trusted HTML markup.
     *
     * @return string Trusted HTML markup.
     */
    public function __toString(): string
    {
        return $this->value;
    }
}
