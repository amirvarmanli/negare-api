/**
 * DTO enforcing UUID validation for user–role route parameters.
 * Used when referencing a specific user-role assignment by its identifier.
 */
import { ApiProperty } from '@nestjs/swagger';
import { IsUUID } from 'class-validator';

export class UserRoleIdParamDto {
  @ApiProperty({
    format: 'uuid',
    description: 'Unique identifier of the user–role assignment record.',
    example: 'b4a9129d-6b24-4f98-99b4-9c9a8f8a14b0',
  })
  @IsUUID('4', {
    message: 'Invalid id format. Must be a valid UUID v4 string.',
  })
  id!: string;
}
