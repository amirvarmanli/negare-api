import {
  BadRequestException,
  Controller,
  Get,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
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
import { RevenueService } from '@app/finance/revenue/revenue.service';
import {
  SubscriptionPoolComputeResponseDto,
  SupplierEarningDto,
} from '@app/finance/revenue/dto/subscription-pool.dto';

@ApiTags('Finance / Revenue')
@Controller()
export class RevenueController {
  constructor(private readonly revenueService: RevenueService) {}

  @Post('admin/revenue/subscription-pools/compute')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @Roles(RoleName.admin)
  @ApiOperation({ summary: 'Compute subscription revenue pool for a period.' })
  @ApiOkResponse({ type: SubscriptionPoolComputeResponseDto })
  async computePool(
    @Query('year') year: string,
    @Query('month') month: string,
  ): Promise<SubscriptionPoolComputeResponseDto> {
    const yearNum = Number(year);
    const monthNum = Number(month);
    if (!Number.isInteger(yearNum) || !Number.isInteger(monthNum)) {
      throw new BadRequestException('Invalid year or month.');
    }
    if (monthNum < 1 || monthNum > 12) {
      throw new BadRequestException('Month must be between 1 and 12.');
    }
    const result = await this.revenueService.computeSubscriptionPool(
      yearNum,
      monthNum,
    );

    return {
      poolId: result.pool.id,
      totalRevenue: result.pool.totalRevenue,
      platformShareAmount: result.pool.platformShareAmount,
      distributableAmount: result.pool.distributableAmount,
      suppliersCount: result.earnings.length,
    };
  }

  @Post('admin/revenue/subscription-pools/:id/finalize')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @Roles(RoleName.admin)
  @ApiOperation({ summary: 'Finalize a subscription revenue pool.' })
  @ApiOkResponse({ type: SubscriptionPoolComputeResponseDto })
  async finalizePool(
    @Param('id') poolId: string,
  ): Promise<SubscriptionPoolComputeResponseDto> {
    const pool = await this.revenueService.finalizeSubscriptionPool(poolId);
    const suppliersCount = await this.revenueService.countPoolSuppliers(poolId);
    return {
      poolId: pool.id,
      totalRevenue: pool.totalRevenue,
      platformShareAmount: pool.platformShareAmount,
      distributableAmount: pool.distributableAmount,
      suppliersCount,
    };
  }

  @Get('supplier/revenue/subscription-earnings')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @Roles(RoleName.supplier)
  @ApiOperation({ summary: 'List subscription earnings for supplier.' })
  @ApiOkResponse({ type: [SupplierEarningDto] })
  async listSupplierEarnings(
    @CurrentUser() user: CurrentUserPayload | undefined,
  ): Promise<SupplierEarningDto[]> {
    const supplierId = requireUserId(user);
    const earnings = await this.revenueService.listSupplierEarnings(supplierId);
    return earnings.map((earning) => ({
      supplierId: earning.supplierId,
      downloadsCredit: Number(earning.downloadsCredit),
      amount: earning.amount,
    }));
  }
}
