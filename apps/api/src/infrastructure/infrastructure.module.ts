import { Global, Module } from '@nestjs/common';
import { LeaderElectionService } from './coordination/leader-election.service';
import { PrismaService } from './prisma/prisma.service';
import { RateLimitGuard } from './rate-limit/rate-limit.guard';
import { TokenBucketLimiter } from './rate-limit/token-bucket.limiter';
import { RedisService } from './redis/redis.service';

/** Shared technical services (DB, cache, coordination). Global so feature modules stay lean. */
@Global()
@Module({
  providers: [PrismaService, RedisService, LeaderElectionService, TokenBucketLimiter, RateLimitGuard],
  exports: [PrismaService, RedisService, LeaderElectionService, TokenBucketLimiter, RateLimitGuard],
})
export class InfrastructureModule {}
