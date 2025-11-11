type CommandResult<T = unknown> = [Error | null, T];
declare class FakeRedisPipeline {
    private readonly redis;
    private readonly commands;
    constructor(redis: FakeRedis);
    set(...args: Parameters<FakeRedis['set']>): this;
    get(...args: Parameters<FakeRedis['get']>): this;
    del(...args: Parameters<FakeRedis['del']>): this;
    sadd(...args: Parameters<FakeRedis['sadd']>): this;
    srem(...args: Parameters<FakeRedis['srem']>): this;
    smembers(...args: Parameters<FakeRedis['smembers']>): this;
    zadd(...args: Parameters<FakeRedis['zadd']>): this;
    zrem(...args: Parameters<FakeRedis['zrem']>): this;
    zrevrange(...args: Parameters<FakeRedis['zrevrange']>): this;
    exec(): Promise<CommandResult[]>;
}
export declare class FakeRedis {
    private readonly values;
    private readonly sets;
    private readonly zsets;
    private readonly expirations;
    pipeline(): FakeRedisPipeline;
    multi(): FakeRedisPipeline;
    set(key: string, value: string, mode?: 'EX', ttl?: number): Promise<'OK'>;
    get(key: string): Promise<string | null>;
    getdel(key: string): Promise<string | null>;
    del(...keys: string[]): Promise<number>;
    sadd(key: string, member: string): Promise<number>;
    srem(key: string, member: string): Promise<number>;
    smembers(key: string): Promise<string[]>;
    zadd(key: string, score: number, member: string): Promise<number>;
    zrem(key: string, member: string): Promise<number>;
    zrevrange(key: string, start: number, stop: number): Promise<string[]>;
    expire(key: string, ttl: number): Promise<number>;
    incr(key: string): Promise<number>;
    ttl(key: string): Promise<number>;
    keys(pattern: string): Promise<string[]>;
    private ensureSet;
    private ensureZSet;
    private scheduleExpiration;
    private isExpired;
    private purgeExpiredValues;
}
export type FakeRedisType = FakeRedis;
export declare const createFakeRedis: () => FakeRedis;
export {};
