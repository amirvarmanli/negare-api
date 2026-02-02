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
import { Roles } from '@app/common/decorators/roles.decorator';
import { RoleName } from '@prisma/client';
import { CreditsService } from '@app/finance/credits/credits.service';
import {
  AdminCreditsQueryDto,
  AdminCreditType,
} from '@app/finance/credits/dto/admin-credits-query.dto';
import { AdminCreditsListResponseDto } from '@app/finance/credits/dto/admin-credits-list.dto';

@ApiTags('Admin - Finance')
@ApiBearerAuth()
@Controller('admin/credits')
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Roles(RoleName.admin)
@Permissions('admin.finance:read')
export class AdminCreditsController {
  constructor(private readonly creditsService: CreditsService) {}

  @Get()
  @ApiOperation({ summary: 'List supplier credit ledger (admin).' })
  @ApiOkResponse({ type: AdminCreditsListResponseDto })
  @ApiQuery({ name: 'page', required: false, example: 1 })
  @ApiQuery({ name: 'limit', required: false, example: 20 })
  @ApiQuery({ name: 'type', required: false, enum: AdminCreditType })
  @ApiQuery({ name: 'q', required: false, example: 'ali' })
  @ApiQuery({ name: 'supplierId', required: false, example: 'supplier-uuid' })
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
    @Query() query: AdminCreditsQueryDto,
  ): Promise<AdminCreditsListResponseDto> {
    return this.creditsService.listAdminCredits(query);
  }
}
