import { Body, Controller, Param, Post, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '@app/core/auth/guards/jwt-auth.guard';
import { Roles } from '@app/common/decorators/roles.decorator';
import { RoleName } from '@prisma/client';
import { PayoutsService } from '@app/finance/payouts/payouts.service';
import {
  PayoutComputeDto,
  PayoutComputeResponseDto,
  PayoutMarkPaidDto,
  SupplierPayoutDto,
} from '@app/finance/payouts/dto/payout.dto';

@ApiTags('Finance / Payouts')
@ApiBearerAuth()
@Controller('admin/payouts')
@UseGuards(JwtAuthGuard)
@Roles(RoleName.admin)
export class PayoutsController {
  constructor(private readonly payoutsService: PayoutsService) {}

  @Post('compute')
  @ApiOperation({ summary: 'Compute supplier payouts (admin).' })
  @ApiOkResponse({ type: PayoutComputeResponseDto })
  async compute(
    @Body() dto: PayoutComputeDto,
  ): Promise<PayoutComputeResponseDto> {
    const payouts = await this.payoutsService.computePayouts(dto);
    return { payouts: payouts.map((payout) => this.toPayoutDto(payout)) };
  }

  @Post(':id/mark-paid')
  @ApiOperation({ summary: 'Mark payout as paid (admin).' })
  @ApiOkResponse({ type: SupplierPayoutDto })
  async markPaid(
    @Param('id') payoutId: string,
    @Body() dto: PayoutMarkPaidDto,
  ): Promise<SupplierPayoutDto> {
    const payout = await this.payoutsService.markPaid(payoutId, dto.reference);
    return this.toPayoutDto(payout);
  }

  @Post(':id/mark-failed')
  @ApiOperation({ summary: 'Mark payout as failed (admin).' })
  @ApiOkResponse({ type: SupplierPayoutDto })
  async markFailed(@Param('id') payoutId: string): Promise<SupplierPayoutDto> {
    const payout = await this.payoutsService.markFailed(payoutId);
    return this.toPayoutDto(payout);
  }

  private toPayoutDto(payout: {
    id: string;
    supplierId: string;
    amount: number;
    periodStart: Date | null;
    periodEnd: Date | null;
    status: string;
    reference: string | null;
  }): SupplierPayoutDto {
    return {
      id: payout.id,
      supplierId: payout.supplierId,
      amount: payout.amount,
      periodStart: payout.periodStart ? payout.periodStart.toISOString().slice(0, 10) : null,
      periodEnd: payout.periodEnd ? payout.periodEnd.toISOString().slice(0, 10) : null,
      status: payout.status as SupplierPayoutDto['status'],
      reference: payout.reference,
    };
  }
}
