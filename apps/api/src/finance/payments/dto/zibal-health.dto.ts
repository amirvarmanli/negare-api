import { ApiProperty } from '@nestjs/swagger';

export class ZibalHealthResponseDto {
  @ApiProperty({ example: true })
  ok!: boolean;

  @ApiProperty({ example: [], isArray: true })
  issues!: string[];

  @ApiProperty({ example: 'https://gateway.zibal.ir' })
  baseUrl!: string;

  @ApiProperty({
    example: 'http://localhost:4000/api/payments/zibal/callback',
  })
  callbackUrl!: string;

  @ApiProperty({ example: '/api/payments/zibal/callback' })
  callbackPath!: string;

  @ApiProperty({
    example: ['/api/payments/callback', '/api/payments/zibal/callback'],
    isArray: true,
  })
  expectedCallbackPaths!: string[];

  @ApiProperty({ example: true })
  merchantPresent!: boolean;

  @ApiProperty({ example: 'TOMAN' })
  amountUnit!: string;

  @ApiProperty({ example: 1000 })
  minAmount!: number;
}
