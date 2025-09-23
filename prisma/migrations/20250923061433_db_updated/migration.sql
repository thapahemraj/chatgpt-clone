/*
  Warnings:

  - You are about to drop the column `chatId` on the `TokenUsage` table. All the data in the column will be lost.

*/
-- DropForeignKey
ALTER TABLE `TokenUsage` DROP FOREIGN KEY `TokenUsage_chatId_fkey`;

-- DropIndex
DROP INDEX `TokenUsage_chatId_fkey` ON `TokenUsage`;

-- AlterTable
ALTER TABLE `TokenUsage` DROP COLUMN `chatId`;
