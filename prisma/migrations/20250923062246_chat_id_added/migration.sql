/*
  Warnings:

  - Added the required column `chatId` to the `TokenUsage` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE `TokenUsage` ADD COLUMN `chatId` VARCHAR(191) NOT NULL;

-- AddForeignKey
ALTER TABLE `TokenUsage` ADD CONSTRAINT `TokenUsage_chatId_fkey` FOREIGN KEY (`chatId`) REFERENCES `Chat`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
