<?php

declare(strict_types=1);

namespace AvenueUI\Core;

final class SchemaParseResult
{
    /**
     * Create a component schema parse result.
     *
     * @param array<string, mixed>         $data   Successfully parsed data.
     * @param list<SchemaValidationIssue> $errors Validation issues.
    */
    public function __construct(
        private array $data,
        private array $errors,
    ) {
    }

    /**
     * Determine whether parsing completed without validation issues.
     *
     * @return bool Whether parsing succeeded.
     */
    public function success(): bool
    {
        return $this->errors === [];
    }

    /**
     * Return parsed data, defaults, and successful nested coercions.
     *
     * @return array<string, mixed> Parsed component data.
    */
    public function data(): array
    {
        return $this->data;
    }

    /**
     * Return all schema validation issues.
     *
     * @return list<SchemaValidationIssue> Validation issues.
    */
    public function errors(): array
    {
        return $this->errors;
    }
}
