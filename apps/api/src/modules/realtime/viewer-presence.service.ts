import { Injectable, OnModuleInit } from '@nestjs/common';
import { appConfig } from '../../common/config/app-config';
import { LuaScript } from '../../infrastructure/redis/lua-script';
import { RedisService } from '../../infrastructure/redis/redis.service';
import { RealtimePublisher } from './realtime.publisher';

const INSTANCES_KEY = 'flashslot:viewer-instances';
const PREFIX = 'flashslot:viewers:';

/** Decrement but never below zero. */
const DECREMENT = new LuaScript<number>(`
local v = redis.call('HINCRBY', KEYS[1], ARGV[1], -1)
if v <= 0 then redis.call('HDEL', KEYS[1], ARGV[1]) end
return v
`);

/** Sum each slot's counter across every API instance's hash. */
const TOTALS = new LuaScript<number[]>(`
local insts = redis.call('SMEMBERS', KEYS[1])
local out = {}
for i = 1, #ARGV do
  local total = 0
  for _, inst in ipairs(insts) do
    local v = redis.call('HGET', '${PREFIX}' .. inst, ARGV[i])
    if v then total = total + tonumber(v) end
  end
  out[i] = total
end
return out
`);

/**
 * "12 people are looking at this deal".
 * Each instance counts its own sockets in its own Redis hash; totals are summed across
 * instances. On restart an instance wipes only its own hash, so stale counts never pile up.
 */
@Injectable()
export class ViewerPresenceService implements OnModuleInit {
  private readonly ownKey = `${PREFIX}${appConfig.instanceId}`;

  constructor(
    private readonly redis: RedisService,
    private readonly publisher: RealtimePublisher,
  ) {}

  async onModuleInit(): Promise<void> {
    await this.redis.client.multi().del(this.ownKey).sadd(INSTANCES_KEY, appConfig.instanceId).exec().catch(() => null);
  }

  async join(slotId: string): Promise<void> {
    await this.redis.client.hincrby(this.ownKey, slotId, 1).catch(() => 0);
    await this.broadcast(slotId);
  }

  async leave(slotId: string): Promise<void> {
    await DECREMENT.run(this.redis.client, [this.ownKey], [slotId]).catch(() => 0);
    await this.broadcast(slotId);
  }

  async counts(slotIds: string[]): Promise<Record<string, number>> {
    if (!slotIds.length) return {};
    const totals = await TOTALS.run(this.redis.client, [INSTANCES_KEY], slotIds).catch(() => [] as number[]);
    return Object.fromEntries(slotIds.map((id, i) => [id, Math.max(0, Number(totals[i] ?? 0))]));
  }

  private async broadcast(slotId: string): Promise<void> {
    const count = (await this.counts([slotId]))[slotId] ?? 0;
    this.publisher.toAll('viewers', { slotId, count });
  }
}
