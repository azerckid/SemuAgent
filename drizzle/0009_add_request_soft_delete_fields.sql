-- Soft delete fields for request-mail cleanup UX.
-- User-facing action is "delete"; data is retained for audit and possible restore.

ALTER TABLE `client_request_schedule`
ADD COLUMN `deleted_at` text;

ALTER TABLE `client_request_schedule`
ADD COLUMN `deleted_by_staff_id` text REFERENCES `staff`(`id`);

ALTER TABLE `client_request_event`
ADD COLUMN `deleted_at` text;

ALTER TABLE `client_request_event`
ADD COLUMN `deleted_by_staff_id` text REFERENCES `staff`(`id`);

ALTER TABLE `upload_session`
ADD COLUMN `deleted_at` text;

ALTER TABLE `upload_session`
ADD COLUMN `deleted_by_staff_id` text REFERENCES `staff`(`id`);
