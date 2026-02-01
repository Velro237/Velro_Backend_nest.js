import { PartialType } from '@nestjs/swagger';
import { CreateShippingRequestDto } from './create-shipping-request.dto';

export class UpdateShippingRequestDto extends PartialType(CreateShippingRequestDto) {}
