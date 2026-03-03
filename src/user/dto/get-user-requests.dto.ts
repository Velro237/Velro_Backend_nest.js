import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional } from 'class-validator';
import { PaginationQueryDto } from 'src/wallet/dto/wallet.dto';

export enum RequestStatus {
  IN_PROGRESS = 'IN_PROGRESS',
  DELIVERED = 'DELIVERED',
  CANCELLED = 'CANCELLED',
}

export class GetUserRequestsQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({
    description: 'Filter requests by status',
    enum: RequestStatus,
    example: RequestStatus.IN_PROGRESS,
  })
  @IsEnum(RequestStatus)
  @IsOptional()
  status?: RequestStatus;
}
