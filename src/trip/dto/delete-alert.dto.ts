import { ApiProperty } from '@nestjs/swagger';

export class DeleteAlertResponseDto {
  @ApiProperty({
    description: 'Success message',
    example: 'Alert deleted successfully',
  })
  message: string;
}
