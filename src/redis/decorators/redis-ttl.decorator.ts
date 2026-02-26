import { Reflector } from '@nestjs/core';

export const RedisTTL = Reflector.createDecorator<number>();
