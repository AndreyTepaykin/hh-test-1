import { Parent, ResolveField, Resolver } from '@nestjs/graphql';
import { Achievement, Experience } from '@prisma/client';
import { ProfileLoaders } from '../common/dataloaders/profile-loaders.service';
import { AchievementModel } from './models/achievement.model';
import { ExperienceModel } from './models/experience.model';

@Resolver(() => ExperienceModel)
export class ExperienceResolver {
  constructor(private readonly loaders: ProfileLoaders) {}

  @ResolveField(() => [AchievementModel])
  achievements(@Parent() experience: Experience): Promise<Achievement[]> {
    return this.loaders.achievements.load(experience.id);
  }
}
