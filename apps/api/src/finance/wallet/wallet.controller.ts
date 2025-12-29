import { Body, Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '@app/core/auth/guards/jwt-auth.guard';
import {
  CurrentUser,
  CurrentUserPayload,
} from '@app/common/decorators/current-user.decorator';
import { requireUserId } from '@app/catalog/utils/current-user.util';
import { WalletService } from '@app/finance/wallet/wallet.service';
import { PaymentsService } from '@app/finance/payments/payments.service';
import {
  PaymentReferenceType,
  WalletTransactionReason,
  WalletTransactionStatus,
  WalletTransactionType,
} from '@app/finance/common/finance.enums';
import {
  WalletBalanceResponseDto,
  WalletCurrencyDto,
} from '@app/finance/wallet/dto/wallet-balance.dto';
import {
  WalletChargeDto,
  WalletChargeResponseDto,
} from '@app/finance/wallet/dto/wallet-charge.dto';
import {
  WalletTransactionsQueryDto,
  WalletTransactionsResponseDto,
} from '@app/finance/wallet/dto/wallet-transactions.dto';
import {
  WalletPayDto,
  WalletPayResponseDto,
} from '@app/finance/wallet/dto/wallet-pay.dto';

@ApiTags('Wallet')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('wallet')
export class WalletController {
  constructor(
    private readonly walletService: WalletService,
    private readonly paymentsService: PaymentsService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Get wallet balance.' })
  @ApiOkResponse({ type: WalletBalanceResponseDto })
  async getWallet(
    @CurrentUser() user: CurrentUserPayload | undefined,
  ): Promise<WalletBalanceResponseDto> {
    const userId = requireUserId(user);
    const wallet = await this.walletService.getWallet(userId);
    return {
      balance: wallet.balance,
      status: wallet.status,
      currency: WalletCurrencyDto.TOMAN,
      updatedAt: wallet.updatedAt.toISOString(),
    };
  }

  @Get('transactions')
  @ApiOperation({ summary: 'List wallet ledger transactions.' })
  @ApiOkResponse({ type: WalletTransactionsResponseDto })
  async listTransactions(
    @Query() query: WalletTransactionsQueryDto,
    @CurrentUser() user: CurrentUserPayload | undefined,
  ): Promise<WalletTransactionsResponseDto> {
    const userId = requireUserId(user);
    const result = await this.walletService.listTransactions(userId, query);
    return {
      items: result.items.map((transaction) => ({
        id: transaction.id,
        type: transaction.type as WalletTransactionType,
        reason: transaction.reason as WalletTransactionReason,
        status: transaction.status as WalletTransactionStatus,
        amount: transaction.amount,
        balanceAfter: transaction.balanceAfter ?? null,
        referenceId: transaction.referenceId ?? null,
        description: transaction.description ?? null,
        createdAt: transaction.createdAt.toISOString(),
      })),
      meta: result.meta,
    };
  }

  @Post('topup')
  @ApiOperation({ summary: 'Top up wallet via gateway.' })
  @ApiOkResponse({ type: WalletChargeResponseDto })
  async chargeWallet(
    @Body() dto: WalletChargeDto,
    @CurrentUser() user: CurrentUserPayload | undefined,
  ): Promise<WalletChargeResponseDto> {
    const userId = requireUserId(user);
    return this.paymentsService.startWalletTopup(userId, dto.amount);
  }

  @Post('charge')
  @ApiOperation({ summary: 'Charge wallet via gateway (legacy).' })
  @ApiOkResponse({ type: WalletChargeResponseDto })
  async chargeWalletLegacy(
    @Body() dto: WalletChargeDto,
    @CurrentUser() user: CurrentUserPayload | undefined,
  ): Promise<WalletChargeResponseDto> {
    const userId = requireUserId(user);
    const refId = `wallet_charge_${randomUUID()}`;
    return this.paymentsService.startPayment(userId, {
      refType: PaymentReferenceType.WALLET_CHARGE,
      refId,
      amount: dto.amount,
    });
  }

  @Post('pay')
  @ApiOperation({ summary: 'Pay with wallet balance.' })
  @ApiOkResponse({ type: WalletPayResponseDto })
  async payWithWallet(
    @Body() dto: WalletPayDto,
    @CurrentUser() user: CurrentUserPayload | undefined,
  ): Promise<WalletPayResponseDto> {
    const userId = requireUserId(user);
    const result = await this.paymentsService.payWithWalletForReference(
      userId,
      dto.refType,
      dto.refId,
    );
    return {
      status: 'success',
      receiptId: result.receiptId,
      paidAmount: result.paidAmount,
      newBalance: result.newBalance,
    };
  }
}
