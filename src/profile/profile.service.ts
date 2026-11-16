import { Injectable, NotFoundException } from '@nestjs/common';
import { Profile } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ProfileService {
  constructor(private readonly prisma: PrismaService) {}

  async findProfile(): Promise<Profile> {
    const profile = await this.prisma.profile.findFirst({
      orderBy: { id: 'asc' },
    });

    if (!profile) {
      throw new NotFoundException('Profile is not seeded');
    }

    return profile;
  }
}
