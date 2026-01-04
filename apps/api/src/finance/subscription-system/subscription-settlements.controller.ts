import { Controller, Post, Query, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '@app/core/auth/guards/jwt-auth.guard';
import { Roles } from '@app/common/decorators/roles.decorator';
import { Permissions } from '@app/common/decorators/permissions.decorator';
import { PermissionsGuard } from '@app/common/guards/permissions.guard';
import { RoleName } from '@prisma/client';
import { SubscriptionSettlementsService } from '@app/finance/subscription-system/subscription-settlements.service';
import { SubscriptionSettlementQueryDto } from '@app/finance/subscription-system/dto/subscription-settlement-query.dto';
import {
  SubscriptionSettlementDto,
  SubscriptionSettlementRunResultDto,
} from '@app/finance/subscription-system/dto/subscription-settlement.dto';
import type {
  SubscriptionSettlement,
  SubscriptionSettlementSupplier,
} from '@prisma/client';

@ApiTags('Finance / Subscription Settlements')
@Controller('admin/subscriptions/settlements')
@UseGuards(JwtAuthGuard, PermissionsGuard)
@ApiBearerAuth()
@Roles(RoleName.admin)
@Permissions('admin.finance:manage')
export class SubscriptionSettlementsController {
  constructor(
    private readonly settlementsService: SubscriptionSettlementsService,
  ) {}

  @Post('expired')
  @ApiOperation({ summary: 'Settle expired subscriptions (admin).' })
  @ApiOkResponse({ type: SubscriptionSettlementRunResultDto })
  async settleExpired(
    @Query() query: SubscriptionSettlementQueryDto,
  ): Promise<SubscriptionSettlementRunResultDto> {
    const settlements = await this.settlementsService.settleExpiredSubscriptions(
      query.limit ?? 50,
    );

    return {
      processed: settlements.length,
      settlements: settlements.map((item) =>
        this.toSettlementDto(item.settlement, item.suppliers),
      ),
    };
  }

  private toSettlementDto(
    settlement: SubscriptionSettlement,
    suppliers: SubscriptionSettlementSupplier[],
  ): SubscriptionSettlementDto {
    return {
      id: settlement.id,
      subscriptionId: settlement.subscriptionId,
      price: settlement.price,
      totalDownloads: settlement.totalDownloads,
      platformAmount: settlement.platformAmount,
      supplierAmount: settlement.supplierAmount,
      createdAt: settlement.createdAt.toISOString(),
      suppliers: suppliers.map((supplier) => ({
        supplierId: supplier.supplierId,
        downloadCount: supplier.downloadCount,
        amount: supplier.amount,
      })),
    };
  }
}
