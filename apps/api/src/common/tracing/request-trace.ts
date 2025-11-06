import { AsyncLocalStorage } from 'node:async_hooks';

export interface RequestTraceContext {
  traceId: string;
  userId?: string;
}

export const requestTraceStorage =
  new AsyncLocalStorage<RequestTraceContext>();
