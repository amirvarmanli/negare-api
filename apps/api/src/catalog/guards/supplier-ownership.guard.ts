import {
  BadRequestException,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Request } from 'express';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  CurrentUserPayload,
} from '@app/common/decorators/current-user.decorator';
import { Product } from '../entities/content/product.entity';
import { isAdmin, isSupplier } from '../policies/catalog.policies';

@Injectable()
export class SupplierOwnershipGuard implements CanActivate {
  constructor(
    @InjectRepository(Product)
    private readonly productsRepository: Repository<Product>,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context
      .switchToHttp()
      .getRequest<Request & { user?: CurrentUserPayload }>();
    const currentUser = request.user;

    if (!currentUser) {
      throw new ForbiddenException('Authentication required');
    }

    if (isAdmin(currentUser)) {
      return true;
    }

    if (!isSupplier(currentUser)) {
      throw new ForbiddenException('Only suppliers may manage products');
    }

    const productId = request.params?.id;
    if (!productId) {
      throw new BadRequestException('Product id param is required');
    }

    const ownsProduct = await this.productsRepository
      .createQueryBuilder('product')
      .innerJoin('product.suppliers', 'supplier', 'supplier.id = :supplierId', {
        supplierId: currentUser.id,
      })
      .where('product.id = :productId', { productId })
      .getExists();

    if (!ownsProduct) {
      throw new ForbiddenException('Supplier does not own this product');
    }

    return true;
  }
}

