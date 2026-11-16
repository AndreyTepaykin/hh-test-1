import { Module } from '@nestjs/common';
import { ProfileLoaders } from '../common/dataloaders/profile-loaders.service';
import { ExperienceResolver } from './experience.resolver';
import { ProfileResolver } from './profile.resolver';
import { ProfileService } from './profile.service';

@Module({
  providers: [
    ProfileService,
    ProfileLoaders,
    ProfileResolver,
    ExperienceResolver,
  ],
})
export class ProfileModule {}
