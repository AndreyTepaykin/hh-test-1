import { Injectable, Scope } from '@nestjs/common';
import DataLoader from 'dataloader';
import { Achievement, Experience, ProfileLink, Project, Skill } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

function groupBy<T>(rows: T[], key: (row: T) => string): Map<string, T[]> {
  const grouped = new Map<string, T[]>();
  for (const row of rows) {
    const id = key(row);
    const bucket = grouped.get(id);
    if (bucket) {
      bucket.push(row);
    } else {
      grouped.set(id, [row]);
    }
  }
  return grouped;
}

@Injectable({ scope: Scope.REQUEST })
export class ProfileLoaders {
  readonly links: DataLoader<string, ProfileLink[]>;
  readonly skills: DataLoader<string, Skill[]>;
  readonly experience: DataLoader<string, Experience[]>;
  readonly projects: DataLoader<string, Project[]>;
  readonly achievements: DataLoader<string, Achievement[]>;

  constructor(prisma: PrismaService) {
    this.links = new DataLoader(async (profileIds) => {
      const rows = await prisma.profileLink.findMany({
        where: { profileId: { in: [...profileIds] } },
        orderBy: { sortOrder: 'asc' },
      });
      const grouped = groupBy(rows, (row) => row.profileId);
      return profileIds.map((id) => grouped.get(id) ?? []);
    });

    this.skills = new DataLoader(async (profileIds) => {
      const rows = await prisma.skill.findMany({
        where: { profileId: { in: [...profileIds] } },
        orderBy: { sortOrder: 'asc' },
      });
      const grouped = groupBy(rows, (row) => row.profileId);
      return profileIds.map((id) => grouped.get(id) ?? []);
    });

    this.experience = new DataLoader(async (profileIds) => {
      const rows = await prisma.experience.findMany({
        where: { profileId: { in: [...profileIds] } },
        orderBy: { sortOrder: 'asc' },
      });
      const grouped = groupBy(rows, (row) => row.profileId);
      return profileIds.map((id) => grouped.get(id) ?? []);
    });

    this.projects = new DataLoader(async (profileIds) => {
      const rows = await prisma.project.findMany({
        where: { profileId: { in: [...profileIds] } },
        orderBy: { sortOrder: 'asc' },
      });
      const grouped = groupBy(rows, (row) => row.profileId);
      return profileIds.map((id) => grouped.get(id) ?? []);
    });

    this.achievements = new DataLoader(async (experienceIds) => {
      const rows = await prisma.achievement.findMany({
        where: { experienceId: { in: [...experienceIds] } },
        orderBy: { sortOrder: 'asc' },
      });
      const grouped = groupBy(rows, (row) => row.experienceId);
      return experienceIds.map((id) => grouped.get(id) ?? []);
    });
  }
}
