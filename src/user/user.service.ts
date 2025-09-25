import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import * as bcrypt from 'bcryptjs';
const userSelect = {
  id: true,
  email: true,
  name: true,
  picture: true,
  role: true,
  createdAt: true,
  updatedAt: true,
};

@Injectable()
export class UserService {
  constructor(private readonly prisma: PrismaService) {}

  async findById(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        email: true,
        role: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return user;
  }

  async create(createUserDto: CreateUserDto) {
    const { email, password, name, picture, role } = createUserDto;

    const exists = await this.prisma.user.findUnique({ where: { email } });
    if (exists)
      throw new ConflictException('User with this email already exists');

    const hashed = password ? await bcrypt.hash(password, 10) : undefined;

    const user = await this.prisma.user.create({
      data: {
        email,
        password: hashed,
        name,
        picture,
        role,
      },
      select: userSelect,
    });

    return user;
  }

  async findAll() {
    return this.prisma.user.findMany({
      orderBy: { createdAt: 'desc' },
      select: userSelect,
    });
  }

  async findOne(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: userSelect,
    });
    if (!user) throw new NotFoundException(`User #${id} not found`);
    return user;
  }

  async update(id: string, updateUserDto: UpdateUserDto) {
    const { email, password, ...rest } = updateUserDto;

    if (email) {
      const dup = await this.prisma.user.findUnique({ where: { email } });
      if (dup && dup.id !== id)
        throw new ConflictException('User with this email already exists');
    }

    const hashed = password ? await bcrypt.hash(password, 10) : undefined;

    try {
      return await this.prisma.user.update({
        where: { id },
        data: {
          ...rest,
          ...(email ? { email } : {}),
          ...(hashed ? { password: hashed } : {}),
        },
        select: userSelect,
      });
    } catch (e) {
      // NotFound → throw
      const exists = await this.prisma.user.findUnique({ where: { id } });
      if (!exists) throw new NotFoundException(`User #${id} not found`);
      throw e;
    }
  }

  async remove(id: string) {
    try {
      const user = await this.prisma.user.delete({
        where: { id },
        select: userSelect,
      });
      return user;
    } catch (e) {
      const exists = await this.prisma.user.findUnique({ where: { id } });
      if (!exists) throw new NotFoundException(`User #${id} not found`);
      throw e;
    }
  }
}
