"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createFakeRedis = exports.FakeRedis = void 0;
class FakeRedisPipeline {
    redis;
    commands = [];
    constructor(redis) {
        this.redis = redis;
    }
    set(...args) {
        this.commands.push(() => this.redis.set(...args));
        return this;
    }
    get(...args) {
        this.commands.push(() => this.redis.get(...args));
        return this;
    }
    del(...args) {
        this.commands.push(() => this.redis.del(...args));
        return this;
    }
    sadd(...args) {
        this.commands.push(() => this.redis.sadd(...args));
        return this;
    }
    srem(...args) {
        this.commands.push(() => this.redis.srem(...args));
        return this;
    }
    smembers(...args) {
        this.commands.push(() => this.redis.smembers(...args));
        return this;
    }
    zadd(...args) {
        this.commands.push(() => this.redis.zadd(...args));
        return this;
    }
    zrem(...args) {
        this.commands.push(() => this.redis.zrem(...args));
        return this;
    }
    zrevrange(...args) {
        this.commands.push(() => this.redis.zrevrange(...args));
        return this;
    }
    exec() {
        return Promise.all(this.commands.map(async (command) => {
            try {
                const result = await command();
                return [null, result];
            }
            catch (error) {
                return [error, null];
            }
        }));
    }
}
class FakeRedis {
    values = new Map();
    sets = new Map();
    zsets = new Map();
    expirations = new Map();
    pipeline() {
        return new FakeRedisPipeline(this);
    }
    multi() {
        return new FakeRedisPipeline(this);
    }
    async set(key, value, mode, ttl) {
        this.values.set(key, value);
        if (mode === 'EX' && typeof ttl === 'number') {
            this.scheduleExpiration(key, ttl * 1000);
        }
        else {
            this.expirations.delete(key);
        }
        return 'OK';
    }
    async get(key) {
        if (this.isExpired(key)) {
            return null;
        }
        return this.values.has(key) ? this.values.get(key) : null;
    }
    async getdel(key) {
        const value = await this.get(key);
        await this.del(key);
        return value;
    }
    async del(...keys) {
        let removed = 0;
        for (const key of keys) {
            if (this.values.delete(key))
                removed++;
            this.expirations.delete(key);
            const set = this.sets.get(key);
            if (set) {
                removed += set.size;
                this.sets.delete(key);
            }
            if (this.zsets.delete(key)) {
                removed++;
            }
        }
        return removed;
    }
    async sadd(key, member) {
        const set = this.ensureSet(key);
        const before = set.size;
        set.add(member);
        return set.size - before;
    }
    async srem(key, member) {
        const set = this.ensureSet(key, false);
        if (!set)
            return 0;
        return set.delete(member) ? 1 : 0;
    }
    async smembers(key) {
        const set = this.ensureSet(key, false);
        return set ? Array.from(set.values()) : [];
    }
    async zadd(key, score, member) {
        const zset = this.ensureZSet(key);
        const existed = zset.has(member);
        zset.set(member, score);
        return existed ? 0 : 1;
    }
    async zrem(key, member) {
        const zset = this.ensureZSet(key, false);
        if (!zset)
            return 0;
        return zset.delete(member) ? 1 : 0;
    }
    async zrevrange(key, start, stop) {
        const zset = this.ensureZSet(key, false);
        if (!zset)
            return [];
        const sorted = Array.from(zset.entries())
            .sort((a, b) => b[1] - a[1])
            .map(([member]) => member);
        const normalizedStop = stop >= 0 ? stop : sorted.length + stop;
        return sorted.slice(start, normalizedStop + 1);
    }
    async expire(key, ttl) {
        if (!this.values.has(key))
            return 0;
        if (ttl <= 0) {
            await this.del(key);
            return 1;
        }
        this.scheduleExpiration(key, ttl * 1000);
        return 1;
    }
    async incr(key) {
        if (this.isExpired(key)) {
            // freshly expired -> treat as absent
        }
        const current = Number(this.values.get(key) ?? '0');
        const next = current + 1;
        this.values.set(key, String(next));
        return next;
    }
    async ttl(key) {
        if (!this.values.has(key))
            return -2;
        const expiry = this.expirations.get(key);
        if (!expiry)
            return -1;
        const msLeft = expiry - Date.now();
        if (msLeft <= 0) {
            this.values.delete(key);
            this.expirations.delete(key);
            return -2;
        }
        return Math.ceil(msLeft / 1000);
    }
    async keys(pattern) {
        this.purgeExpiredValues();
        const escaped = pattern.replace(/[-[\]/{}()*+?.\\^$|]/g, '\\$&');
        const regex = new RegExp(`^${escaped.replace(/\\\*/g, '.*')}$`);
        const bag = new Set([
            ...this.values.keys(),
            ...this.sets.keys(),
            ...this.zsets.keys(),
        ]);
        return Array.from(bag).filter((key) => regex.test(key));
    }
    ensureSet(key, create = true) {
        if (!this.sets.has(key) && create) {
            this.sets.set(key, new Set());
        }
        return this.sets.get(key);
    }
    ensureZSet(key, create = true) {
        if (!this.zsets.has(key) && create) {
            this.zsets.set(key, new Map());
        }
        return this.zsets.get(key);
    }
    scheduleExpiration(key, ttlMs) {
        const expiresAt = Date.now() + ttlMs;
        this.expirations.set(key, expiresAt);
        const ms = Math.min(Math.max(ttlMs, 0), 0x7fffffff);
        const timeout = setTimeout(() => {
            this.values.delete(key);
            this.expirations.delete(key);
        }, ms);
        timeout.unref?.();
    }
    isExpired(key) {
        const expiry = this.expirations.get(key);
        if (!expiry) {
            return false;
        }
        if (expiry <= Date.now()) {
            this.expirations.delete(key);
            this.values.delete(key);
            return true;
        }
        return false;
    }
    purgeExpiredValues() {
        for (const key of Array.from(this.expirations.keys())) {
            this.isExpired(key);
        }
    }
}
exports.FakeRedis = FakeRedis;
const createFakeRedis = () => new FakeRedis();
exports.createFakeRedis = createFakeRedis;
