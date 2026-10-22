-- Add requesterPicks flag to approval_steps.
-- When true, requester must pick exactly one approver from approverIds
-- at submission time. The stepSnapshot stored on the Request is then
-- narrowed to only the chosen approver.
ALTER TABLE "approval_steps" ADD COLUMN "requesterPicks" BOOLEAN NOT NULL DEFAULT false;
