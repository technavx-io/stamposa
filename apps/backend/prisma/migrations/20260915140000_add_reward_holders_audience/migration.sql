-- New audience segment for targeted broadcasts to reward-holders.
ALTER TYPE "BroadcastAudience" ADD VALUE IF NOT EXISTS 'REWARD_HOLDERS';
