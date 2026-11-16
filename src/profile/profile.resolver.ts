import { Parent, Query, ResolveField, Resolver } from '@nestjs/graphql';
import { Experience, Profile, ProfileLink, Project, Skill } from '@prisma/client';
import { ProfileLoaders } from '../common/dataloaders/profile-loaders.service';
import { ExperienceModel } from './models/experience.model';
import { ProfileLinkModel } from './models/profile-link.model';
import { ProfileModel } from './models/profile.model';
import { ProjectModel } from './models/project.model';
import { SkillModel } from './models/skill.model';
import { ProfileService } from './profile.service';

@Resolver(() => ProfileModel)
export class ProfileResolver {
  constructor(
    private readonly profiles: ProfileService,
    private readonly loaders: ProfileLoaders,
  ) {}

  @Query(() => ProfileModel)
  profile(): Promise<Profile> {
    return this.profiles.findProfile();
  }

  @ResolveField(() => [ProfileLinkModel])
  links(@Parent() profile: Profile): Promise<ProfileLink[]> {
    return this.loaders.links.load(profile.id);
  }

  @ResolveField(() => [SkillModel])
  skills(@Parent() profile: Profile): Promise<Skill[]> {
    return this.loaders.skills.load(profile.id);
  }

  @ResolveField(() => [ExperienceModel])
  experience(@Parent() profile: Profile): Promise<Experience[]> {
    return this.loaders.experience.load(profile.id);
  }

  @ResolveField(() => [ProjectModel])
  projects(@Parent() profile: Profile): Promise<Project[]> {
    return this.loaders.projects.load(profile.id);
  }
}
