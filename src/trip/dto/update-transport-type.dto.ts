import { PartialType, ApiProperty } from '@nestjs/swagger';
import { CreateTransportTypeDto } from './create-transport-type.dto';

export class UpdateTransportTypeDto extends PartialType(
  CreateTransportTypeDto,
) {}

export class UpdateTransportTypeResponseDto {
  @ApiProperty({
    description: 'Success message',
    example: 'Transport type updated successfully',
  })
  message: string;

  @ApiProperty({
    description: 'Updated transport type information',
    example: {
      id: '123e4567-e89b-12d3-a456-426614174000',
      name: 'Airplane',
      description: 'Updated commercial airline transportation',
    },
  })
  transportType: {
    id: string;
    name: string;
    description: string | null;
  };
}
