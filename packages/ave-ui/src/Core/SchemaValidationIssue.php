<?php

declare(strict_types=1);

namespace AvenueUI\Core;

final class SchemaValidationIssue
{
    /**
     * Create a structured schema validation issue.
     *
     * @param string $path     Dot-separated value path.
     * @param string $rule     Failed validation rule.
     * @param string $message  Human-readable error message.
     * @param mixed  $expected Expected value or constraint.
     * @param mixed  $received Received value.
     */
    public function __construct(
        public string $path,
        public string $rule,
        public string $message,
        public mixed $expected = null,
        public mixed $received = null,
    ) {
    }

    /**
     * Convert the issue to a serializable array.
     *
     * @return array{
     *     path: string,
     *     rule: string,
     *     message: string,
     *     expected: mixed,
     *     received: mixed
     * } Structured validation issue.
    */
    public function toArray(): array
    {
        return [
            'path' => $this->path,
            'rule' => $this->rule,
            'message' => $this->message,
            'expected' => $this->expected,
            'received' => $this->received,
        ];
    }
}
