-- CreateTable
CREATE TABLE `PaymentOrder` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `orderId` VARCHAR(191) NOT NULL,
    `userId` INTEGER NOT NULL,
    `amountMnt` INTEGER NOT NULL DEFAULT 10000,
    `plan` VARCHAR(191) NOT NULL DEFAULT 'PRO_MONTHLY',
    `duration` VARCHAR(191) NOT NULL DEFAULT 'ONE_MONTH',
    `bankName` VARCHAR(191) NOT NULL DEFAULT 'TDB',
    `bankAccount` VARCHAR(191) NOT NULL DEFAULT '140005000499582572',
    `bankHolderName` VARCHAR(191) NOT NULL DEFAULT 'Аззаяа Баяртай',
    `transactionCode` VARCHAR(191) NULL,
    `screenshotUrl` LONGTEXT NULL,
    `status` VARCHAR(191) NOT NULL DEFAULT 'PENDING',
    `rejectReason` TEXT NULL,
    `reviewedAt` DATETIME(3) NULL,
    `reviewedBy` INTEGER NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `PaymentOrder_orderId_key`(`orderId`),
    UNIQUE INDEX `PaymentOrder_transactionCode_key`(`transactionCode`),
    INDEX `PaymentOrder_userId_idx`(`userId`),
    INDEX `PaymentOrder_status_idx`(`status`),
    INDEX `PaymentOrder_createdAt_idx`(`createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- RenameIndex
ALTER TABLE `notification` RENAME INDEX `notification_receiverId_idx` TO `Notification_receiverId_idx`;

-- RenameIndex
ALTER TABLE `notification` RENAME INDEX `notification_senderId_idx` TO `Notification_senderId_idx`;
