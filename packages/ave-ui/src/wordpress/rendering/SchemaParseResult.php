<?php

declare(strict_types=1);

namespace AvenueUI\Core;

final class SchemaParseResult
{
   /**
    * @param array<string, mixed> $data
    * @param list<SchemaValidationIssue> $errors
    */
   public function __construct(
      private array $data,
      private array $errors,
   ) {
   }

   public function success(): bool
   {
      return $this->errors === [];
   }

   /**
    * Parsed data, including defaults and successful nested coercions.
    *
    * @return array<string, mixed>
    */
   public function data(): array
   {
      return $this->data;
   }

   /**
    * @return list<SchemaValidationIssue>
    */
   public function errors(): array
   {
      return $this->errors;
   }
}
