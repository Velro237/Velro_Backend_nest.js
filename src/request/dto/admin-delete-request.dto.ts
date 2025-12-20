import { ApiProperty } from '@nestjs/swagger';

export class AdminDeleteRequestResponseDto {
  @ApiProperty({
    description: 'Success message',
    example: 'Request deleted successfully',
  })
  message: string;

  @ApiProperty({
    description: 'Deleted request ID',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  requestId: string;
}
