<?php

declare(strict_types=1);

namespace AvenueUI\Core;

final class SchemaValidationIssue
{
   public function __construct(
      public string $path,
      public string $rule,
      public string $message,
      public mixed $expected = null,
      public mixed $received = null,
   ) {
   }

   /**
    * @return array{
    *    path: string,
    *    rule: string,
    *    message: string,
    *    expected: mixed,
    *    received: mixed
    * }
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
