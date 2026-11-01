import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { appConfig } from '../../common/config/app-config';
import { LuaScript } from '../redis/lua-script';
import { RedisService } from '../redis/redis.service';

const LEADER_KEY = 'flashslot:leader';
const LEASE_MS = 10_000;
const RENEW_EVERY_MS = 3_000;

/** Acquire the lease if free, or renew it if we already own it. Atomic. */
const ACQUIRE_OR_RENEW = new LuaScript<number>(`
local current = redis.call('GET', KEYS[1])
if current == ARGV[1] then
  redis.call('PEXPIRE', KEYS[1], ARGV[2])
  return 1
end
if not current then
  redis.call('SET', KEYS[1], ARGV[1], 'PX', ARGV[2])
  return 1
end
return 0
`);

const RELEASE = new LuaScript<number>(`
if redis.call('GET', KEYS[1]) == ARGV[1] then return redis.call('DEL', KEYS[1]) end
return 0
`);

/**
 * Leader election with a Redis lease.
 * When several API instances run behind the load balancer, background jobs (price ticker,
 * hold-expiry sweeper, outbox relay) must run on exactly ONE of them. The instance holding
 * the lease is the leader; if it dies the lease expires and another instance takes over.
 */
@Injectable()
export class LeaderElectionService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(LeaderElectionService.name);
  private leader = false;
  private timer?: NodeJS.Timeout;

  constructor(private readonly redis: RedisService) {}

  get isLeader(): boolean {
    return this.leader;
  }

  async onModuleInit(): Promise<void> {
    await this.tick();
    this.timer = setInterval(() => void this.tick(), RENEW_EVERY_MS);
  }

  async onModuleDestroy(): Promise<void> {
    if (this.timer) clearInterval(this.timer);
    if (this.leader) await RELEASE.run(this.redis.client, [LEADER_KEY], [appConfig.instanceId]).catch(() => 0);
  }

  private async tick(): Promise<void> {
    try {
      const won = (await ACQUIRE_OR_RENEW.run(this.redis.client, [LEADER_KEY], [appConfig.instanceId, LEASE_MS])) === 1;
      if (won !== this.leader) {
        this.logger.log(won ? `${appConfig.instanceId} became LEADER` : `${appConfig.instanceId} lost leadership`);
      }
      this.leader = won;
    } catch {
      this.leader = false;
    }
  }
}
