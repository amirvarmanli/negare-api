import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiQuery,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '@app/core/auth/guards/jwt-auth.guard';
import {
  CurrentUser,
  CurrentUserPayload,
} from '@app/common/decorators/current-user.decorator';
import { requireUserId } from '@app/catalog/utils/current-user.util';
import { PurchasesService } from '@app/finance/purchases/purchases.service';
import {
  PurchasesPageDto,
  PurchaseItemDto,
} from '@app/finance/purchases/dto/purchase.dto';

@ApiTags('Finance / Purchases')
@ApiBearerAuth()
@Controller('me')
export class PurchasesController {
  constructor(private readonly purchasesService: PurchasesService) {}

  @Get('purchases')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'List current user purchases.' })
  @ApiOkResponse({ type: PurchasesPageDto })
  @ApiUnauthorizedResponse({ description: 'Unauthorized.' })
  @ApiQuery({ name: 'page', required: false, example: 1 })
  @ApiQuery({ name: 'pageSize', required: false, example: 20 })
  async list(
    @CurrentUser() user: CurrentUserPayload | undefined,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ): Promise<PurchasesPageDto> {
    const userId = requireUserId(user);
    const parsedPage = page ? Number(page) : undefined;
    const parsedPageSize = pageSize ? Number(pageSize) : undefined;
    return this.purchasesService.listForUser(
      userId,
      parsedPage,
      parsedPageSize,
    );
  }

  @Get('purchases/:productId')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Get a single purchase by product id.' })
  @ApiOkResponse({ type: PurchaseItemDto })
  @ApiNotFoundResponse({ description: 'Purchase not found.' })
  @ApiUnauthorizedResponse({ description: 'Unauthorized.' })
  async getOne(
    @Param('productId') productId: string,
    @CurrentUser() user: CurrentUserPayload | undefined,
  ): Promise<PurchaseItemDto> {
    const userId = requireUserId(user);
    return this.purchasesService.getForUserProduct(userId, productId);
  }
}
