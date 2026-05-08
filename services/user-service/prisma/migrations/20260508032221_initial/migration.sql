-- AlterTable
ALTER TABLE `user` ADD COLUMN `description` TEXT NULL,
    ADD COLUMN `location` VARCHAR(191) NULL,
    ADD COLUMN `logo` VARCHAR(191) NULL,
    ADD COLUMN `website` VARCHAR(191) NULL;
