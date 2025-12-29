import { Body, Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '@app/core/auth/guards/jwt-auth.guard';
import { Roles } from '@app/common/decorators/roles.decorator';
import { RoleName } from '@prisma/client';
import { DiscountsAdminService } from '@app/finance/discounts/discounts-admin.service';
import {
  CouponDto,
  CreateCouponDto,
  CreateProductDiscountDto,
  CreateUserDiscountDto,
  DiscountListQueryDto,
  PaginatedCouponsDto,
  PaginatedProductDiscountsDto,
  PaginatedUserDiscountsDto,
  ProductDiscountDto,
  UserDiscountDto,
} from '@app/finance/discounts/dto/discount-admin.dto';
import { toBigIntString } from '@app/finance/common/prisma.utils';

@ApiTags('Finance / Discounts')
@Controller('admin/discounts')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
@Roles(RoleName.admin)
export class DiscountsController {
  constructor(private readonly discountsAdmin: DiscountsAdminService) {}

  @Post('products')
  @ApiOperation({ summary: 'Create a product discount (admin).' })
  @ApiCreatedResponse({ type: ProductDiscountDto })
  async createProductDiscount(
    @Body() dto: CreateProductDiscountDto,
  ): Promise<ProductDiscountDto> {
    const saved = await this.discountsAdmin.createProductDiscount(dto);
    return this.toProductDiscountDto(saved);
  }

  @Get('products')
  @ApiOperation({ summary: 'List product discounts (admin).' })
  @ApiOkResponse({ type: PaginatedProductDiscountsDto })
  async listProductDiscounts(
    @Query() query: DiscountListQueryDto,
  ): Promise<PaginatedProductDiscountsDto> {
    const result = await this.discountsAdmin.listProductDiscounts(query);
    return {
      data: result.data.map((item) => this.toProductDiscountDto(item)),
      total: result.total,
      page: result.page,
      limit: result.limit,
      hasNext: result.hasNext,
    };
  }

  @Post('users')
  @ApiOperation({ summary: 'Create a user discount (admin).' })
  @ApiCreatedResponse({ type: UserDiscountDto })
  async createUserDiscount(
    @Body() dto: CreateUserDiscountDto,
  ): Promise<UserDiscountDto> {
    const saved = await this.discountsAdmin.createUserDiscount(dto);
    return this.toUserDiscountDto(saved);
  }

  @Get('users')
  @ApiOperation({ summary: 'List user discounts (admin).' })
  @ApiOkResponse({ type: PaginatedUserDiscountsDto })
  async listUserDiscounts(
    @Query() query: DiscountListQueryDto,
  ): Promise<PaginatedUserDiscountsDto> {
    const result = await this.discountsAdmin.listUserDiscounts(query);
    return {
      data: result.data.map((item) => this.toUserDiscountDto(item)),
      total: result.total,
      page: result.page,
      limit: result.limit,
      hasNext: result.hasNext,
    };
  }

  @Post('coupons')
  @ApiOperation({ summary: 'Create a coupon (admin).' })
  @ApiCreatedResponse({ type: CouponDto })
  async createCoupon(@Body() dto: CreateCouponDto): Promise<CouponDto> {
    const saved = await this.discountsAdmin.createCoupon(dto);
    return this.toCouponDto(saved);
  }

  @Get('coupons')
  @ApiOperation({ summary: 'List coupons (admin).' })
  @ApiOkResponse({ type: PaginatedCouponsDto })
  async listCoupons(
    @Query() query: DiscountListQueryDto,
  ): Promise<PaginatedCouponsDto> {
    const result = await this.discountsAdmin.listCoupons(query);
    return {
      data: result.data.map((item) => this.toCouponDto(item)),
      total: result.total,
      page: result.page,
      limit: result.limit,
      hasNext: result.hasNext,
    };
  }

  private toProductDiscountDto(
    item: { id: string; productId: bigint; type: string; value: number; startsAt: Date | null; endsAt: Date | null; isActive: boolean },
  ): ProductDiscountDto {
    return {
      id: item.id,
      productId: toBigIntString(item.productId),
      type: item.type as ProductDiscountDto['type'],
      value: item.value,
      startsAt: item.startsAt ? item.startsAt.toISOString() : null,
      endsAt: item.endsAt ? item.endsAt.toISOString() : null,
      isActive: item.isActive,
    };
  }

  private toUserDiscountDto(
    item: { id: string; userId: string; type: string; value: number; startsAt: Date | null; endsAt: Date | null; isActive: boolean },
  ): UserDiscountDto {
    return {
      id: item.id,
      userId: item.userId,
      type: item.type as UserDiscountDto['type'],
      value: item.value,
      startsAt: item.startsAt ? item.startsAt.toISOString() : null,
      endsAt: item.endsAt ? item.endsAt.toISOString() : null,
      isActive: item.isActive,
    };
  }

  private toCouponDto(item: {
    id: string;
    code: string;
    type: string;
    value: number;
    maxUsage: number | null;
    maxUsagePerUser: number | null;
    expiresAt: Date | null;
    isActive: boolean;
  }): CouponDto {
    return {
      id: item.id,
      code: item.code,
      type: item.type as CouponDto['type'],
      value: item.value,
      maxUsage: item.maxUsage,
      maxUsagePerUser: item.maxUsagePerUser,
      expiresAt: item.expiresAt ? item.expiresAt.toISOString() : null,
      isActive: item.isActive,
    };
  }
}
