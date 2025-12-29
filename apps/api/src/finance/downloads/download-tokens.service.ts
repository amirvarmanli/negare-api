import { randomUUID } from 'node:crypto';
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { JwtPayload, Secret, SignOptions } from 'jsonwebtoken';
import { sign, verify } from 'jsonwebtoken';
import type { AllConfig } from '@app/config/config.module';
import { DOWNLOAD_TOKEN_TTL_SECONDS } from '@app/finance/common/finance.constants';

type AuthConfigLike =
  | {
      accessSecret: string;
      accessExpires: string;
      refreshSecret: string;
      refreshExpires: string;
      cookie?: {
        sameSite: 'strict' | 'lax' | 'none';
        secure: boolean;
        refreshPath: string;
        accessPath: string;
      };
    }
  | {
      jwt: {
        issuer?: string;
        audience?: string;
        accessSecret: string;
        refreshSecret: string;
      };
      accessExpires: string;
      refreshExpires: string;
      cookie?: {
        sameSite: 'strict' | 'lax' | 'none';
        secure: boolean;
        refreshPath: string;
        accessPath: string;
      };
    };

export interface DownloadTokenPayload extends JwtPayload {
  sub: string;
  oid: string;
  fid: string;
  typ: 'download';
}

@Injectable()
export class DownloadTokensService {
  private readonly accessSecret: Secret;
  private readonly issuer: string | undefined;
  private readonly audience: string | undefined;

  constructor(private readonly config: ConfigService<AllConfig>) {
    const auth = this.config.get<AuthConfigLike>('auth', { infer: true });
    if (!auth) {
      throw new Error('Auth configuration is not available.');
    }

    this.accessSecret = (
      'jwt' in auth ? auth.jwt.accessSecret : auth.accessSecret
    ) as Secret;
    this.issuer = 'jwt' in auth ? auth.jwt.issuer : undefined;
    this.audience = 'jwt' in auth ? auth.jwt.audience : undefined;
  }

  signDownloadToken(params: {
    userId: string;
    orderId: string;
    fileId: string;
  }): { token: string; expiresAt: Date } {
    const jti = randomUUID();
    const payload: DownloadTokenPayload = {
      sub: params.userId,
      oid: params.orderId,
      fid: params.fileId,
      typ: 'download',
      jti,
    };

    const opts: SignOptions = {
      algorithm: 'HS256',
      expiresIn: DOWNLOAD_TOKEN_TTL_SECONDS,
      ...(this.issuer ? { issuer: this.issuer } : {}),
      ...(this.audience ? { audience: this.audience } : {}),
    };

    const token = sign(payload, this.accessSecret, opts);
    const expiresAt = new Date(Date.now() + DOWNLOAD_TOKEN_TTL_SECONDS * 1000);
    return { token, expiresAt };
  }

  issueToken(params: {
    userId: string;
    orderId: string;
    fileId: string;
  }): { token: string; expiresAt: Date } {
    return this.signDownloadToken(params);
  }

  verifyToken(token: string): DownloadTokenPayload {
    try {
      const opts: import('jsonwebtoken').VerifyOptions = {
        algorithms: ['HS256'],
        ...(this.issuer ? { issuer: this.issuer } : {}),
        ...(this.audience ? { audience: this.audience } : {}),
      };
      const decoded = verify(token, this.accessSecret, opts) as DownloadTokenPayload;
      if (
        decoded.typ !== 'download' ||
        !decoded.sub ||
        !decoded.oid ||
        !decoded.fid
      ) {
        throw new UnauthorizedException('Malformed download token.');
      }
      return decoded;
    } catch {
      throw new UnauthorizedException('Invalid or expired download token.');
    }
  }
}
