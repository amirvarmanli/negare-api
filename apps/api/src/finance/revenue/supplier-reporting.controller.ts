import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '@app/core/auth/guards/jwt-auth.guard';
import { Roles } from '@app/common/decorators/roles.decorator';
import { RoleName } from '@prisma/client';
import {
  CurrentUser,
  CurrentUserPayload,
} from '@app/common/decorators/current-user.decorator';
import { requireUserId } from '@app/catalog/utils/current-user.util';
import { toBigIntString } from '@app/finance/common/prisma.utils';
import {
  EarningStatus,
  EntitlementSource,
  PayoutStatus,
} from '@app/finance/common/finance.enums';
import {
  PaginatedSupplierDownloadsDto,
  PaginatedSupplierOrdersDto,
  PaginatedSupplierSubscriptionEarningsDto,
  SupplierReportQueryDto,
  SupplierRevenueSummaryDto,
} from '@app/finance/revenue/dto/supplier-reporting.dto';
import { SupplierReportingService } from '@app/finance/revenue/supplier-reporting.service';

@ApiTags('Finance / Supplier Reports')
@ApiBearerAuth()
@Controller()
@UseGuards(JwtAuthGuard)
@Roles(RoleName.supplier, RoleName.admin)
export class SupplierReportingController {
  constructor(private readonly reportingService: SupplierReportingService) {}

  @Get('supplier/revenue/summary')
  @ApiOperation({ summary: 'Supplier revenue summary (supplier/admin).' })
  @ApiOkResponse({ type: SupplierRevenueSummaryDto })
  async summary(
    @Query() query: SupplierReportQueryDto,
    @CurrentUser() user: CurrentUserPayload | undefined,
  ): Promise<SupplierRevenueSummaryDto> {
    const supplierId = this.resolveSupplierId(user, query.supplierId);
    return this.reportingService.getSummary(supplierId);
  }

  @Get('supplier/revenue/orders')
  @ApiOperation({ summary: 'Supplier paid order earnings (supplier/admin).' })
  @ApiOkResponse({ type: PaginatedSupplierOrdersDto })
  async orders(
    @Query() query: SupplierReportQueryDto,
    @CurrentUser() user: CurrentUserPayload | undefined,
  ): Promise<PaginatedSupplierOrdersDto> {
    const supplierId = this.resolveSupplierId(user, query.supplierId);
    const result = await this.reportingService.listOrders({
      supplierId,
      page: query.page,
      limit: query.limit,
    });
    return {
      data: result.data.map((item) => ({
        orderId: item.orderId,
        productId: toBigIntString(item.productId),
        amount: item.amount,
        paidAt: item.order.paidAt ? item.order.paidAt.toISOString() : item.order.createdAt.toISOString(),
        payoutStatus: (item.payout?.status as PayoutStatus) ?? null,
      })),
      total: result.total,
      page: result.page,
      limit: result.limit,
      hasNext: result.hasNext,
    };
  }

  @Get('supplier/revenue/subscriptions')
  @ApiOperation({ summary: 'Supplier subscription earnings (supplier/admin).' })
  @ApiOkResponse({ type: PaginatedSupplierSubscriptionEarningsDto })
  async subscriptions(
    @Query() query: SupplierReportQueryDto,
    @CurrentUser() user: CurrentUserPayload | undefined,
  ): Promise<PaginatedSupplierSubscriptionEarningsDto> {
    const supplierId = this.resolveSupplierId(user, query.supplierId);
    const result = await this.reportingService.listSubscriptionEarnings({
      supplierId,
      page: query.page,
      limit: query.limit,
    });
    return {
      data: result.data.map((item) => ({
        id: item.id,
        poolId: item.poolId,
        periodStart: item.pool.periodStart.toISOString().slice(0, 10),
        periodEnd: item.pool.periodEnd.toISOString().slice(0, 10),
        amount: item.amount,
        status: item.status as EarningStatus,
        payoutStatus: (item.payout?.status as PayoutStatus) ?? null,
      })),
      total: result.total,
      page: result.page,
      limit: result.limit,
      hasNext: result.hasNext,
    };
  }

  @Get('supplier/downloads')
  @ApiOperation({ summary: 'Supplier download logs (supplier/admin).' })
  @ApiOkResponse({ type: PaginatedSupplierDownloadsDto })
  async downloads(
    @Query() query: SupplierReportQueryDto,
    @CurrentUser() user: CurrentUserPayload | undefined,
  ): Promise<PaginatedSupplierDownloadsDto> {
    const supplierId = this.resolveSupplierId(user, query.supplierId);
    const result = await this.reportingService.listDownloads({
      supplierId,
      page: query.page,
      limit: query.limit,
    });
    return {
      data: result.data.map((item) => ({
        id: item.id,
        userId: item.userId,
        productId: toBigIntString(item.productId),
        dateTime: item.dateTime.toISOString(),
        source: item.source as EntitlementSource,
      })),
      total: result.total,
      page: result.page,
      limit: result.limit,
      hasNext: result.hasNext,
    };
  }

  private resolveSupplierId(
    user: CurrentUserPayload | undefined,
    requestedId?: string,
  ): string | undefined {
    const userId = requireUserId(user);
    const isAdmin = user?.roles?.includes(RoleName.admin) ?? false;
    if (isAdmin) {
      return requestedId;
    }
    return userId;
  }
}
