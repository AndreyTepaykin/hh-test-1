import { Field, GraphQLISODateTime, ID, ObjectType } from '@nestjs/graphql';
import { AchievementModel } from './achievement.model';

@ObjectType()
export class ExperienceModel {
  @Field(() => ID)
  id!: string;

  @Field()
  company!: string;

  @Field()
  position!: string;

  @Field(() => GraphQLISODateTime)
  startDate!: Date;

  @Field(() => GraphQLISODateTime, { nullable: true })
  endDate!: Date | null;

  @Field(() => String, { nullable: true })
  companyUrl!: string | null;

  @Field(() => [AchievementModel])
  achievements!: AchievementModel[];
}
