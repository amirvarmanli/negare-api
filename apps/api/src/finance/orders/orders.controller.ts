import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '@app/core/auth/guards/jwt-auth.guard';
import {
  CurrentUser,
  CurrentUserPayload,
} from '@app/common/decorators/current-user.decorator';
import { requireUserId } from '@app/catalog/utils/current-user.util';
import {
  OrdersService,
  type OrderDetailResult,
  type OrderEntitlementResult,
  type OrderWithItems,
} from '@app/finance/orders/orders.service';
import { CreateOrderDto } from '@app/finance/orders/dto/create-order.dto';
import { OrderResponseDto } from '@app/finance/orders/dto/order-response.dto';
import { toBigIntString } from '@app/finance/common/prisma.utils';
import {
  OrderDetailDto,
  OrderDetailEntitlementDto,
  OrderDetailPaymentDto,
} from '@app/finance/orders/dto/order-detail.dto';
import { PurchaseResultDto } from '@app/finance/orders/dto/purchase-result.dto';

@ApiTags('Orders')
@ApiBearerAuth()
@Controller('orders')
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  @Post()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Create a paid product order.' })
  @ApiCreatedResponse({ type: OrderResponseDto })
  async createOrder(
    @Body() dto: CreateOrderDto,
    @CurrentUser() user: CurrentUserPayload | undefined,
  ): Promise<OrderResponseDto> {
    const userId = requireUserId(user);
    const order = await this.ordersService.createProductOrder(userId, dto);
    return this.toOrderResponse(order);
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Get an order by id for current user.' })
  @ApiOkResponse({ type: OrderDetailDto })
  @ApiNotFoundResponse({ description: 'Order not found.' })
  @ApiUnauthorizedResponse({ description: 'Unauthorized.' })
  async getOrderById(
    @Param('id') orderId: string,
    @CurrentUser() user: CurrentUserPayload | undefined,
  ): Promise<OrderDetailDto> {
    const userId = requireUserId(user);
    const result = await this.ordersService.getByIdForUser(orderId, userId);
    return this.toOrderDetailResponse(result.order, result.entitlements);
  }

  @Get(':id/purchase-result')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Get purchase result (order-based).' })
  @ApiOkResponse({ type: PurchaseResultDto })
  @ApiNotFoundResponse({ description: 'Order not found.' })
  @ApiUnauthorizedResponse({ description: 'Unauthorized.' })
  async getPurchaseResult(
    @Param('id') orderId: string,
    @CurrentUser() user: CurrentUserPayload | undefined,
  ): Promise<PurchaseResultDto> {
    const userId = requireUserId(user);
    return this.ordersService.getPurchaseResult(orderId, userId);
  }

  private toOrderResponse(order: OrderWithItems): OrderResponseDto {
    return {
      id: order.id,
      status: order.status as OrderResponseDto['status'],
      orderKind: order.orderKind as OrderResponseDto['orderKind'],
      subtotal: order.subtotal,
      discountType: order.discountType as OrderResponseDto['discountType'],
      discountValue: order.discountValue,
      total: order.total,
      currency: 'TOMAN',
      items:
        order.items?.map((item) => ({
          id: item.id,
          productId: toBigIntString(item.productId),
          quantity: item.quantity,
          unitPriceSnapshot: item.unitPriceSnapshot,
          lineTotal: item.lineTotal,
          productTypeSnapshot: item.productTypeSnapshot as OrderResponseDto['items'][number]['productTypeSnapshot'],
        })) ?? [],
      createdAt: order.createdAt.toISOString(),
      paidAt: order.paidAt ? order.paidAt.toISOString() : null,
    };
  }

  private toOrderDetailResponse(
    order: OrderDetailResult,
    entitlements: OrderEntitlementResult[],
  ): OrderDetailDto {
    return {
      id: order.id,
      status: order.status as OrderDetailDto['status'],
      orderKind: order.orderKind as OrderDetailDto['orderKind'],
      total: order.total,
      currency: 'TOMAN',
      createdAt: order.createdAt.toISOString(),
      items: order.items.map((item) => ({
        id: item.id,
        productId: toBigIntString(item.productId),
        productTitle: item.product.title,
        unitPriceSnapshot: item.unitPriceSnapshot,
        quantity: item.quantity,
        subtotal: item.lineTotal,
      })),
      payments: order.payments.map(
        (payment): OrderDetailPaymentDto => ({
          id: payment.id,
          provider: payment.provider as OrderDetailPaymentDto['provider'],
          status: payment.status as OrderDetailPaymentDto['status'],
          trackId: payment.trackId ?? null,
          authority: payment.authority ?? null,
          amount: payment.amount,
          createdAt: payment.createdAt.toISOString(),
        }),
      ),
      entitlements: entitlements.map(
        (entitlement): OrderDetailEntitlementDto => ({
          productId: toBigIntString(entitlement.productId),
          source: entitlement.source as OrderDetailEntitlementDto['source'],
          createdAt: entitlement.createdAt.toISOString(),
        }),
      ),
    };
  }
}
