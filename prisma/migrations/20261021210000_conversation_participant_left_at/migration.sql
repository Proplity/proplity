-- AlterTable: a tenant whose tenancy ended keeps reading the history up to this moment (ISS-142)
ALTER TABLE "ConversationParticipant" ADD COLUMN "leftAt" TIMESTAMP(3);
