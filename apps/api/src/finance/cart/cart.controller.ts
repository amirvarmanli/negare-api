import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '@app/core/auth/guards/jwt-auth.guard';
import {
  CurrentUser,
  CurrentUserPayload,
} from '@app/common/decorators/current-user.decorator';
import { requireUserId } from '@app/catalog/utils/current-user.util';
import { CartService, type CartView, type CheckoutResult } from '@app/finance/cart/cart.service';
import { AddCartItemDto } from '@app/finance/cart/dto/add-cart-item.dto';
import { UpdateCartItemDto } from '@app/finance/cart/dto/update-cart-item.dto';
import { CartCheckoutDto } from '@app/finance/cart/dto/cart-checkout.dto';
import {
  CartCheckoutResponseDto,
  CartResponseDto,
} from '@app/finance/cart/dto/cart-response.dto';

@ApiTags('Finance / Cart')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('cart')
export class CartController {
  constructor(private readonly cartService: CartService) {}

  @Get()
  @ApiOperation({ summary: 'Get current cart with totals.' })
  @ApiOkResponse({ type: CartResponseDto })
  async getCart(
    @CurrentUser() user: CurrentUserPayload | undefined,
  ): Promise<CartResponseDto> {
    const userId = requireUserId(user);
    const cart = await this.cartService.getCart(userId);
    return this.toCartResponse(cart);
  }

  @Post('items')
  @ApiOperation({ summary: 'Add an item to the cart.' })
  @ApiOkResponse({ type: CartResponseDto })
  async addItem(
    @Body() dto: AddCartItemDto,
    @CurrentUser() user: CurrentUserPayload | undefined,
  ): Promise<CartResponseDto> {
    const userId = requireUserId(user);
    const quantity = dto.qty ?? 1;
    const cart = await this.cartService.addItem(userId, {
      productId: dto.productId,
      quantity,
    });
    return this.toCartResponse(cart);
  }

  @Patch('items/:productId')
  @ApiOperation({ summary: 'Update cart item quantity (0 removes the item).' })
  @ApiParam({ name: 'productId' })
  @ApiOkResponse({ type: CartResponseDto })
  async updateItem(
    @Param('productId') productId: string,
    @Body() dto: UpdateCartItemDto,
    @CurrentUser() user: CurrentUserPayload | undefined,
  ): Promise<CartResponseDto> {
    const userId = requireUserId(user);
    const cart = await this.cartService.updateItemByProduct(
      userId,
      productId,
      dto.qty,
    );
    return this.toCartResponse(cart);
  }

  @Delete('items/:productId')
  @ApiOperation({ summary: 'Remove an item from the cart.' })
  @ApiParam({ name: 'productId' })
  @ApiOkResponse({ type: CartResponseDto })
  async removeItem(
    @Param('productId') productId: string,
    @CurrentUser() user: CurrentUserPayload | undefined,
  ): Promise<CartResponseDto> {
    const userId = requireUserId(user);
    const cart = await this.cartService.removeItemByProduct(userId, productId);
    return this.toCartResponse(cart);
  }

  @Delete('clear')
  @ApiOperation({ summary: 'Clear all items in the cart.' })
  @ApiOkResponse({ type: CartResponseDto })
  async clearCart(
    @CurrentUser() user: CurrentUserPayload | undefined,
  ): Promise<CartResponseDto> {
    const userId = requireUserId(user);
    const cart = await this.cartService.clearCart(userId);
    return this.toCartResponse(cart);
  }

  @Post('checkout')
  @ApiOperation({ summary: 'Checkout cart and create a pending order.' })
  @ApiOkResponse({ type: CartCheckoutResponseDto })
  async checkout(
    @Body() dto: CartCheckoutDto,
    @CurrentUser() user: CurrentUserPayload | undefined,
  ): Promise<CartCheckoutResponseDto> {
    const userId = requireUserId(user);
    const result = await this.cartService.checkout(userId, dto.couponCode);
    return this.toCheckoutResponse(result);
  }

  private toCartResponse(cart: CartView): CartResponseDto {
    return {
      cartId: cart.id,
      items: cart.items.map((item) => ({
        productId: item.productId,
        qty: item.quantity,
        unitPrice: item.unitPrice,
        title: item.product.title ?? undefined,
        coverImage: item.product.coverUrl ?? undefined,
      })),
      totalAmount: cart.totals.total,
    };
  }

  private toCheckoutResponse(result: CheckoutResult): CartCheckoutResponseDto {
    return {
      orderId: result.order.id,
      total: result.order.total,
      itemsCount: result.itemsCount,
    };
  }
}
