// apps/api/src/core/upload/upload.gateway.ts
import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
  WsException,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger, UnauthorizedException } from '@nestjs/common';

// =======================
// Event names (constants)
// =======================
export const EV_JOIN = 'join';
export const EV_JOINED = 'joined';
export const EV_LEAVE = 'leave';
export const EV_LEFT = 'left';
export const EV_SERVER_PROGRESS = 'serverUploadProgress';
export const EV_UPLOADED = 'uploaded';
export const EV_ERROR = 'uploadError';
export const EV_PING = 'ping';
export const EV_PONG = 'pong';

// =======================
// DTOs / helpers
// =======================
type ServerProgressEvent = {
  uploadId: string;
  sent: number; // bytes sent so far
  total: number; // total file size in bytes
  percent: number; // 0..100
};

type UploadedEvent = {
  uploadId: string;
  url: string;
  path: string;
};

type ErrorEvent = {
  uploadId?: string;
  code: string; // e.g. 'INVALID_ID' | 'UNAUTHORIZED' | 'INTERNAL'
  message?: string; // human-friendly (avoid leaking internals in prod)
};

// Parse and normalize allowed CORS origins (comma-separated)
function parseCorsOrigins(input?: string): string[] {
  if (!input) return ['http://localhost:3000'];
  return input
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

// Optional lightweight validation (UUID-ish or short id)
function isValidUploadId(id: unknown): id is string {
  if (typeof id !== 'string') return false;
  if (id.length < 8 || id.length > 128) return false;
  // Stricter sample (UUID v4):
  // return /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id);
  return true;
}

function safePercent(sent: number, total: number): number {
  if (total <= 0) return 0;
  const p = (sent / total) * 100;
  // clamp + 1 decimal
  return Math.max(0, Math.min(100, Math.round(p * 10) / 10));
}

// =======================
// (Optional) auth hook
// =======================
// اگر WebSocket سشن باید به کاربر متصل باشد، این تابع را به سرویس JWT وصل کن
async function authenticateSocket(
  client: Socket,
): Promise<{ userId?: string } | null> {
  // نمونه: از هدر/کوکی توکن را بخوان
  // const token = client.handshake.auth?.token || client.handshake.headers['authorization'];
  // verify...
  return { userId: undefined }; // فعلاً اختیاری
}

@WebSocketGateway({
  namespace: '/upload',
  cors: {
    origin: parseCorsOrigins(process.env.CORS_ORIGIN),
    credentials: true,
  },
})
export class UploadGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer() server!: Server;
  private readonly logger = new Logger(UploadGateway.name);

  // محدودیت سبک برای flood (در هر سوکت، حداقل فاصله بین joinها)
  private readonly joinCooldownMs = 200;

  async handleConnection(client: Socket) {
    try {
      const auth = await authenticateSocket(client);
      client.data.userId = auth?.userId;
      client.data.lastJoinAt = 0;
      this.logger.debug(`client connected: ${client.id}`);
      // پاسخ به پینگ‌های کلاینت
      client.on(EV_PING, () => client.emit(EV_PONG, { t: Date.now() }));
    } catch (e) {
      this.logger.warn(`auth failed for ${client.id}: ${(e as Error).message}`);
      client.emit(EV_ERROR, <ErrorEvent>{ code: 'UNAUTHORIZED' });
      client.disconnect(true);
    }
  }

  handleDisconnect(client: Socket) {
    this.logger.debug(`client disconnected: ${client.id}`);
    // socket.io rooms cleaned automatically
  }

  /**
   * client -> server: join a room by uploadId
   * payload: { uploadId: string }
   */
  @SubscribeMessage(EV_JOIN)
  handleJoin(
    @MessageBody() body: { uploadId?: string },
    @ConnectedSocket() client: Socket,
  ) {
    const id = body?.uploadId;
    if (!isValidUploadId(id)) {
      throw new WsException('Invalid uploadId');
    }

    // flood control
    const now = Date.now();
    if (typeof client.data.lastJoinAt === 'number') {
      if (now - client.data.lastJoinAt < this.joinCooldownMs) {
        // ignore rapid joins
        return;
      }
    }
    client.data.lastJoinAt = now;

    const room = this.room(id);
    client.join(room);
    client.data.uploadId = id;
    client.emit(EV_JOINED, { uploadId: id });
    this.logger.debug(`client ${client.id} joined ${room}`);
  }

  /**
   * client -> server: leave a room by uploadId
   * payload: { uploadId?: string }
   */
  @SubscribeMessage(EV_LEAVE)
  handleLeave(
    @MessageBody() body: { uploadId?: string },
    @ConnectedSocket() client: Socket,
  ) {
    const id = body?.uploadId ?? client.data.uploadId;
    if (!isValidUploadId(id)) {
      throw new WsException('Invalid uploadId');
    }
    const room = this.room(id);
    client.leave(room);
    client.emit(EV_LEFT, { uploadId: id });
    this.logger.debug(`client ${client.id} left ${room}`);
  }

  // =======================
  // Server-side emit helpers
  // =======================
  /** Emit server->storage progress to all listeners of this uploadId. */
  emitServerProgress(ev: ServerProgressEvent) {
    try {
      if (!this.server) return;
      if (!isValidUploadId(ev.uploadId)) return;

      const percent = safePercent(ev.sent, ev.total);
      const payload: ServerProgressEvent = { ...ev, percent };

      this.server.to(this.room(ev.uploadId)).emit(EV_SERVER_PROGRESS, payload);
    } catch (e) {
      this.logger.warn(`emitServerProgress failed: ${(e as Error).message}`);
    }
  }

  /** Emit final uploaded event with the resolved URL/path. */
  emitUploaded(ev: UploadedEvent) {
    try {
      if (!this.server) return;
      if (!isValidUploadId(ev.uploadId)) return;

      this.server.to(this.room(ev.uploadId)).emit(EV_UPLOADED, ev);
    } catch (e) {
      this.logger.warn(`emitUploaded failed: ${(e as Error).message}`);
    }
  }

  /** Emit error event (standardized) */
  emitError(ev: ErrorEvent) {
    try {
      if (!this.server) return;
      if (ev.uploadId && !isValidUploadId(ev.uploadId)) return;

      const target = ev.uploadId
        ? this.server.to(this.room(ev.uploadId))
        : this.server;
      target.emit(EV_ERROR, ev);
    } catch (e) {
      this.logger.warn(`emitError failed: ${(e as Error).message}`);
    }
  }

  // =======================
  // Internals
  // =======================
  private room(uploadId: string) {
    return `upload:${uploadId}`;
  }
}
