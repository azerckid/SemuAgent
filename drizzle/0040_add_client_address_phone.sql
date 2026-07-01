-- 고객사 주소·전화번호. 둘 다 nullable이라 단순 ADD COLUMN으로 충분하다.
ALTER TABLE `client` ADD COLUMN `address` text;
--> statement-breakpoint
ALTER TABLE `client` ADD COLUMN `phone` text;
