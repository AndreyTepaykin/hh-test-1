import 'reflect-metadata';

import { plainToInstance, Type } from 'class-transformer';
import {
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Max,
  Min,
  validateSync,
} from 'class-validator';

export enum NodeEnv {
  Development = 'development',
  Test = 'test',
  Production = 'production',
}

/**
 * Every environment variable the application relies on.
 *
 * `validateEnvironment` coerces the raw strings from `process.env` / `.env`
 * (e.g. `PORT` becomes a number) and fails the bootstrap when a required
 * variable is missing or malformed, so configuration errors surface at
 * startup instead of on the first request.
 */
export class EnvironmentVariables {
  @IsEnum(NodeEnv)
  @IsOptional()
  NODE_ENV: NodeEnv = NodeEnv.Development;

  // Explicit conversion keeps this working without `emitDecoratorMetadata`
  // (e.g. when the module is loaded by tsx/esbuild, as `prisma db seed` does).
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(65535)
  @IsOptional()
  PORT = 3000;

  @IsString()
  @IsNotEmpty()
  DATABASE_URL!: string;
}

export function validateEnvironment(
  config: Record<string, unknown>,
): EnvironmentVariables {
  const validated = plainToInstance(EnvironmentVariables, config);

  const errors = validateSync(validated, { skipMissingProperties: false });

  if (errors.length > 0) {
    const details = errors
      .map((error) => {
        const constraints = Object.values(error.constraints ?? {}).join('; ');
        return `  - ${error.property}: ${constraints || 'invalid value'}`;
      })
      .join('\n');

    throw new Error(`Invalid environment variables:\n${details}`);
  }

  return validated;
}
