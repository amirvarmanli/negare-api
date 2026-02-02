import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '@app/core/auth/guards/jwt-auth.guard';
import { Roles } from '@app/common/decorators/roles.decorator';
import { Permissions } from '@app/common/decorators/permissions.decorator';
import { PermissionsGuard } from '@app/common/guards/permissions.guard';
import { RoleName } from '@prisma/client';
import {
  CreateDiscountCouponDto,
  DiscountCouponDto,
  DiscountCouponListQueryDto,
  PaginatedDiscountCouponsDto,
  UpdateDiscountCouponDto,
} from '@app/finance/discounts/dto/discount-admin.dto';
import { DiscountCouponsAdminService } from '@app/finance/discounts/discount-coupons-admin.service';
import type { DiscountCoupon } from '@prisma/client';

@ApiTags('Finance / Discount Coupons')
@Controller('admin/discount-coupons')
@UseGuards(JwtAuthGuard, PermissionsGuard)
@ApiBearerAuth()
@Roles(RoleName.admin)
@Permissions('admin.finance:manage')
export class DiscountCouponsController {
  constructor(
    private readonly discountCouponsService: DiscountCouponsAdminService,
  ) {}

  @Post()
  @ApiOperation({ summary: 'Create a discount coupon (admin).' })
  @ApiCreatedResponse({ type: DiscountCouponDto })
  async create(
    @Body() dto: CreateDiscountCouponDto,
  ): Promise<DiscountCouponDto> {
    const coupon = await this.discountCouponsService.createCoupon(dto);
    return this.toDto(coupon);
  }

  @Get()
  @ApiOperation({ summary: 'List discount coupons (admin).' })
  @ApiOkResponse({ type: PaginatedDiscountCouponsDto })
  async list(
    @Query() query: DiscountCouponListQueryDto,
  ): Promise<PaginatedDiscountCouponsDto> {
    const result = await this.discountCouponsService.listCoupons({
      page: query.page,
      limit: query.limit,
      q: query.q,
      isActive: query.isActive,
      includeDeleted: query.includeDeleted,
    });
    return {
      data: result.data.map((coupon) => this.toDto(coupon)),
      total: result.total,
      page: result.page,
      limit: result.limit,
      hasNext: result.hasNext,
    };
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get discount coupon detail (admin).' })
  @ApiOkResponse({ type: DiscountCouponDto })
  async get(@Param('id') id: string): Promise<DiscountCouponDto> {
    const coupon = await this.discountCouponsService.getCoupon(id);
    return this.toDto(coupon);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a discount coupon (admin).' })
  @ApiOkResponse({ type: DiscountCouponDto })
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateDiscountCouponDto,
  ): Promise<DiscountCouponDto> {
    const coupon = await this.discountCouponsService.updateCoupon(id, dto);
    return this.toDto(coupon);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Archive (soft delete) a discount coupon (admin).' })
  @ApiOkResponse({ type: DiscountCouponDto })
  async delete(@Param('id') id: string): Promise<DiscountCouponDto> {
    const coupon = await this.discountCouponsService.removeCoupon(id);
    return this.toDto(coupon);
  }

  private toDto(coupon: DiscountCoupon): DiscountCouponDto {
    return {
      id: coupon.id,
      title: coupon.title,
      code: coupon.code,
      valueType: coupon.valueType,
      value: coupon.value,
      maxUsage: coupon.maxUsage,
      usedCount: coupon.usedCount,
      note: coupon.note ?? null,
      expiresAt: coupon.expiresAt ? coupon.expiresAt.toISOString() : null,
      deletedAt: coupon.deletedAt ? coupon.deletedAt.toISOString() : null,
      isActive: coupon.isActive,
      createdAt: coupon.createdAt.toISOString(),
      updatedAt: coupon.updatedAt.toISOString(),
    };
  }
}
