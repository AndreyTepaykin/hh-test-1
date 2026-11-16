import { Field, ID, ObjectType } from '@nestjs/graphql';

@ObjectType()
export class AchievementModel {
  @Field(() => ID)
  id!: string;

  @Field()
  text!: string;
}
