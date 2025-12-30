import { ApiPropertyOptional } from '@nestjs/swagger';

export class DeleteDeliveryResponseDto {
  @ApiPropertyOptional({
    description: 'Success message',
    example: 'Delivery deleted successfully',
  })
  message: string;
}

