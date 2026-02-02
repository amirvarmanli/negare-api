import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '@app/core/auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '@app/common/guards/permissions.guard';
import { Permissions } from '@app/common/decorators/permissions.decorator';
import { PurchasesService } from '@app/finance/purchases/purchases.service';
import {
  AdminOrdersQueryDto,
  AdminPurchasePaymentStatus,
} from '@app/finance/purchases/dto/admin-purchases-query.dto';
import { AdminOrdersListResponseDto } from '@app/finance/purchases/dto/admin-purchases-list.dto';

@ApiTags('Admin - Purchases')
@ApiBearerAuth()
@Controller('admin/purchases')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class AdminPurchasesController {
  constructor(private readonly purchasesService: PurchasesService) {}

  @Get()
  @Permissions('admin.orders:read')
  @ApiOperation({ summary: 'List purchases with filters and pagination.' })
  @ApiOkResponse({ type: AdminOrdersListResponseDto })
  @ApiQuery({ name: 'page', required: false, example: 1 })
  @ApiQuery({ name: 'limit', required: false, example: 20 })
  @ApiQuery({
    name: 'status',
    required: false,
    enum: AdminPurchasePaymentStatus,
  })
  @ApiQuery({ name: 'q', required: false, example: 'amir' })
  @ApiQuery({
    name: 'from',
    required: false,
    example: '2025-01-01T00:00:00.000Z',
  })
  @ApiQuery({
    name: 'to',
    required: false,
    example: '2025-12-31T23:59:59.999Z',
  })
  async list(
    @Query() query: AdminOrdersQueryDto,
  ): Promise<AdminOrdersListResponseDto> {
    return this.purchasesService.listAdminPurchases(query);
  }
}
