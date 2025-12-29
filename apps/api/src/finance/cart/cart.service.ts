import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '@app/prisma/prisma.service';
import { DiscountsService } from '@app/finance/discounts/discounts.service';
import {
  CartStatus,
  EntitlementSource,
  OrderKind,
  OrderStatus,
  ProductPricingType,
} from '@app/finance/common/finance.enums';
import { ORDER_PAYMENT_TTL_MINUTES } from '@app/finance/common/finance.constants';
import { toBigInt, toBigIntString } from '@app/finance/common/prisma.utils';
import type {
  FinanceCart,
  FinanceCartItem,
  FinanceCartStatus,
  FinanceDiscountType,
  FinanceEntitlementSource,
  FinanceOrder,
  FinanceOrderKind,
  FinanceOrderStatus,
  PricingType,
  Prisma,
  Product,
} from '@prisma/client';

interface CartProductRecord
  extends Pick<Product, 'id' | 'title' | 'pricingType' | 'price' | 'coverUrl'> {}

type CartItemWithProduct = FinanceCartItem & { product: CartProductRecord };

type CartWithItems = FinanceCart & { items: CartItemWithProduct[] };

export interface CartLineItem {
  cartItemId: string;
  productId: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
  pricingType: ProductPricingType;
  product: CartProductRecord;
}

export interface CartTotals {
  subtotal: number;
  discount: number;
  total: number;
}

export interface CartView {
  id: string;
  items: CartLineItem[];
  totals: CartTotals;
}

export interface CheckoutResult {
  order: FinanceOrder;
  itemsCount: number;
}

export interface CartSnapshot {
  cart: FinanceCart;
  lineItems: CartLineItem[];
  subtotal: number;
  discountType: FinanceDiscountType;
  discountValue: number;
  total: number;
  couponId?: string;
}

@Injectable()
export class CartService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly discountsService: DiscountsService,
  ) {}

  async getCart(userId: string): Promise<CartView> {
    const cart = await this.loadOrCreateCart(userId);
    return this.buildCartView(userId, cart);
  }

  async getCartSnapshot(userId: string, couponCode?: string): Promise<CartSnapshot> {
    return this.getCartSnapshotWithClient(this.prisma, userId, couponCode);
  }

  async getCartSnapshotInTransaction(
    tx: Prisma.TransactionClient,
    userId: string,
    couponCode?: string,
  ): Promise<CartSnapshot> {
    return this.getCartSnapshotWithClient(tx, userId, couponCode);
  }

  async addItem(
    userId: string,
    input: { productId: string; quantity: number },
  ): Promise<CartView> {
    this.assertQuantityAllowed(input.quantity);
    await this.ensureProductPurchasable(userId, input.productId);

    await this.prisma.$transaction(async (tx) => {
      const cart = await this.getOrCreateActiveCart(tx, userId);
      const productId = toBigInt(input.productId);
      const existing = await tx.financeCartItem.findUnique({
        where: { cartId_productId: { cartId: cart.id, productId } },
      });

      const nextQuantity = (existing?.quantity ?? 0) + input.quantity;
      this.assertQuantityAllowed(nextQuantity);

      if (existing) {
        await tx.financeCartItem.update({
          where: { id: existing.id },
          data: { quantity: nextQuantity },
        });
      } else {
        await tx.financeCartItem.create({
          data: {
            cartId: cart.id,
            productId,
            quantity: input.quantity,
          },
        });
      }
    });

    return this.getCart(userId);
  }

  async updateItemByProduct(
    userId: string,
    productId: string,
    quantity: number,
  ): Promise<CartView> {
    if (quantity < 0) {
      throw new BadRequestException('Quantity must be at least 0.');
    }
    this.assertQuantityAllowed(quantity, true);

    const item = await this.prisma.financeCartItem.findFirst({
      where: { cart: { userId }, productId: toBigInt(productId) },
    });

    if (!item) {
      throw new NotFoundException('Cart item not found.');
    }

    if (quantity === 0) {
      await this.prisma.financeCartItem.delete({ where: { id: item.id } });
      return this.getCart(userId);
    }

    await this.prisma.financeCartItem.update({
      where: { id: item.id },
      data: { quantity },
    });

    return this.getCart(userId);
  }

  async removeItemByProduct(
    userId: string,
    productId: string,
  ): Promise<CartView> {
    const item = await this.prisma.financeCartItem.findFirst({
      where: { cart: { userId }, productId: toBigInt(productId) },
    });

    if (!item) {
      throw new NotFoundException('Cart item not found.');
    }

    await this.prisma.financeCartItem.delete({ where: { id: item.id } });
    return this.getCart(userId);
  }

  async clearCart(userId: string): Promise<CartView> {
    const cart = await this.loadOrCreateCart(userId);
    await this.prisma.financeCartItem.deleteMany({ where: { cartId: cart.id } });
    await this.prisma.financeCart.update({
      where: { id: cart.id },
      data: { status: CartStatus.ACTIVE as FinanceCartStatus },
    });
    return this.getCart(userId);
  }

  async clearCartInTransaction(
    tx: Prisma.TransactionClient,
    cartId: string,
    status: CartStatus,
  ): Promise<void> {
    await tx.financeCartItem.deleteMany({ where: { cartId } });
    await tx.financeCart.update({
      where: { id: cartId },
      data: { status: status as FinanceCartStatus },
    });
  }

  async checkout(userId: string, couponCode?: string): Promise<CheckoutResult> {
    return this.prisma.$transaction(async (tx) => {
      // Keep this transaction strictly DB-only to avoid long-running locks/timeouts.
      const cart = await this.loadCartWithItems(tx, userId);
      if (!cart || cart.items.length === 0) {
        throw new BadRequestException('Cart is empty.');
      }

      const lineItems = this.buildLineItems(cart);
      const subtotal = lineItems.reduce((sum, item) => sum + item.lineTotal, 0);
      const resolution = await this.discountsService.resolveDiscount(tx, {
        userId,
        orderKind: OrderKind.PRODUCT,
        items: lineItems.map((item) => ({
          productId: item.productId,
          pricingType: item.pricingType,
          unitPrice: item.unitPrice,
          quantity: item.quantity,
          lineTotal: item.lineTotal,
        })),
        couponCode: couponCode?.trim() || undefined,
      });
      const total = Math.max(0, subtotal - resolution.discountValue);

      await this.ensureNotPurchasedForItems(
        tx,
        userId,
        lineItems.map((item) => item.productId),
      );

      const lock = await tx.financeCart.updateMany({
        where: {
          id: cart.id,
          status: CartStatus.ACTIVE as FinanceCartStatus,
        },
        data: { status: CartStatus.CHECKED_OUT as FinanceCartStatus },
      });

      if (lock.count === 0) {
        throw new ConflictException('Cart has already been checked out.');
      }

      const order = await tx.financeOrder.create({
        data: {
          userId,
          status: OrderStatus.PENDING_PAYMENT as FinanceOrderStatus,
          orderKind: OrderKind.PRODUCT as FinanceOrderKind,
          subtotal,
          discountType: resolution.discountType as FinanceDiscountType,
          discountValue: resolution.discountValue,
          total,
          currency: 'TOMAN',
          subscriptionPlanId: null,
          subscriptionDurationMonths: null,
          paidAt: null,
          expiresAt: new Date(
            Date.now() + ORDER_PAYMENT_TTL_MINUTES * 60 * 1000,
          ),
        },
      });

      const itemsData = lineItems.map((item) => ({
        orderId: order.id,
        productId: item.product.id,
        unitPriceSnapshot: item.unitPrice,
        quantity: item.quantity,
        lineTotal: item.lineTotal,
        productTypeSnapshot: item.pricingType as PricingType,
      }));

      await tx.financeOrderItem.createMany({ data: itemsData });

      if (resolution.couponId && resolution.discountValue > 0) {
        await tx.financeCouponRedemption.create({
          data: {
            couponId: resolution.couponId,
            userId,
            orderId: order.id,
            amount: resolution.discountValue,
          },
        });
      }

      await tx.financeCartItem.deleteMany({ where: { cartId: cart.id } });

      return { order, itemsCount: lineItems.length };
    }, { timeout: 10000 });
  }

  private async ensureProductPurchasable(
    userId: string,
    productId: string,
  ): Promise<void> {
    const product = await this.prisma.product.findUnique({
      where: { id: toBigInt(productId) },
      select: { pricingType: true, price: true },
    });

    if (!product) {
      throw new NotFoundException('Product not found.');
    }

    this.assertPurchasableProduct(product);
    await this.ensureNotPurchasedForItems(this.prisma, userId, [productId]);
  }

  private async ensureNotPurchasedForItems(
    tx: Prisma.TransactionClient,
    userId: string,
    productIds: string[],
  ): Promise<void> {
    if (productIds.length === 0) {
      return;
    }
    const existing = await tx.financeEntitlement.findMany({
      where: {
        userId,
        productId: { in: productIds.map(toBigInt) },
        source: EntitlementSource.PURCHASED as FinanceEntitlementSource,
      },
      select: { productId: true },
    });
    if (existing.length > 0) {
      throw new ConflictException('Product already purchased.');
    }
  }

  private assertPurchasableProduct(
    product: Pick<Product, 'pricingType' | 'price'>,
  ): void {
    if (product.pricingType === ProductPricingType.FREE) {
      throw new BadRequestException('FREE products cannot be added to cart.');
    }
    if (!product.price || Number(product.price) <= 0) {
      throw new BadRequestException('Product price is not set.');
    }
  }

  private assertQuantityAllowed(quantity: number, allowZero = false): void {
    const min = allowZero ? 0 : 1;
    if (quantity < min) {
      throw new BadRequestException(`Quantity must be at least ${min}.`);
    }
  }

  private async loadOrCreateCart(userId: string): Promise<CartWithItems> {
    const cart = await this.loadCartWithItems(this.prisma, userId);
    if (cart) {
      return cart;
    }

    const created = await this.prisma.financeCart.create({
      data: { userId, status: CartStatus.ACTIVE as FinanceCartStatus },
    });

    return { ...created, items: [] };
  }

  private async loadCartWithItems(
    tx: Prisma.TransactionClient,
    userId: string,
  ): Promise<CartWithItems | null> {
    return tx.financeCart.findUnique({
      where: { userId },
      include: {
        items: {
          orderBy: { createdAt: 'asc' },
          include: {
            product: {
              select: {
                id: true,
                title: true,
                pricingType: true,
                price: true,
                coverUrl: true,
              },
            },
          },
        },
      },
    });
  }

  private async getOrCreateActiveCart(
    tx: Prisma.TransactionClient,
    userId: string,
  ): Promise<FinanceCart> {
    const existing = await tx.financeCart.findUnique({ where: { userId } });
    if (!existing) {
      return tx.financeCart.create({
        data: { userId, status: CartStatus.ACTIVE as FinanceCartStatus },
      });
    }

    if (existing.status !== CartStatus.ACTIVE) {
      return tx.financeCart.update({
        where: { id: existing.id },
        data: { status: CartStatus.ACTIVE as FinanceCartStatus },
      });
    }

    return existing;
  }

  private buildLineItems(cart: CartWithItems): CartLineItem[] {
    return cart.items.map((item) => {
      this.assertQuantityAllowed(item.quantity);
      this.assertPurchasableProduct(item.product);

      const pricingType = item.product.pricingType as ProductPricingType;
      const unitPrice = Math.round(Number(item.product.price));
      const lineTotal = unitPrice * item.quantity;

      return {
        cartItemId: item.id,
        productId: toBigIntString(item.product.id),
        quantity: item.quantity,
        unitPrice,
        lineTotal,
        pricingType,
        product: item.product,
      };
    });
  }

  private async buildCartView(
    userId: string,
    cart: CartWithItems,
  ): Promise<CartView> {
    if (cart.items.length === 0) {
      return {
        id: cart.id,
        items: [],
        totals: { subtotal: 0, discount: 0, total: 0 },
      };
    }

    const lineItems = this.buildLineItems(cart);
    const subtotal = lineItems.reduce((sum, item) => sum + item.lineTotal, 0);
    const resolution = await this.discountsService.resolveDiscount(
      this.prisma,
      {
        userId,
        orderKind: OrderKind.PRODUCT,
        items: lineItems.map((item) => ({
          productId: item.productId,
          pricingType: item.pricingType,
          unitPrice: item.unitPrice,
          quantity: item.quantity,
          lineTotal: item.lineTotal,
        })),
      },
    );

    return {
      id: cart.id,
      items: lineItems,
      totals: {
        subtotal,
        discount: resolution.discountValue,
        total: Math.max(0, subtotal - resolution.discountValue),
      },
    };
  }

  private async getCartSnapshotWithClient(
    tx: Prisma.TransactionClient,
    userId: string,
    couponCode?: string,
  ): Promise<CartSnapshot> {
    const cart = await this.loadCartWithItems(tx, userId);
    if (!cart || cart.items.length === 0) {
      throw new BadRequestException('Cart is empty.');
    }

    const lineItems = this.buildLineItems(cart);
    const subtotal = lineItems.reduce((sum, item) => sum + item.lineTotal, 0);
    const resolution = await this.discountsService.resolveDiscount(tx, {
      userId,
      orderKind: OrderKind.PRODUCT,
      items: lineItems.map((item) => ({
        productId: item.productId,
        pricingType: item.pricingType,
        unitPrice: item.unitPrice,
        quantity: item.quantity,
        lineTotal: item.lineTotal,
      })),
      couponCode: couponCode?.trim() || undefined,
    });

    return {
      cart,
      lineItems,
      subtotal,
      discountType: resolution.discountType as FinanceDiscountType,
      discountValue: resolution.discountValue,
      total: Math.max(0, subtotal - resolution.discountValue),
      couponId: resolution.couponId,
    };
  }
}
