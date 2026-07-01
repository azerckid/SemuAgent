CREATE TABLE `consultation_source_cache` (
  `id` text PRIMARY KEY NOT NULL,
  `query_hash` text NOT NULL,
  `source` text NOT NULL,
  `response_json` text NOT NULL,
  `total_count` integer NOT NULL,
  `cached_at` text NOT NULL,
  `expires_at` text NOT NULL
);

CREATE UNIQUE INDEX `consultation_source_cache_query_hash_uidx`
  ON `consultation_source_cache` (`query_hash`);

CREATE INDEX `consultation_source_cache_expires_idx`
  ON `consultation_source_cache` (`expires_at`);
