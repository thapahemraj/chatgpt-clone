/*
  Warnings:

  - You are about to drop the column `image` on the `Chat` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE `Chat` DROP COLUMN `image`;

-- AlterTable
ALTER TABLE `User` ADD COLUMN `image` VARCHAR(191) NULL;
