import { plainToInstance } from 'class-transformer';
import {
  IsInt,
  IsIn,
  IsOptional,
  IsString,
  Matches,
  Max,
  Min,
  validateSync,
} from 'class-validator';

export class Env {
  @Matches(/^mongodb(\+srv)?:\/\//, {
    message: 'MONGODB_URI must start with mongodb:// or mongodb+srv://',
  })
  MONGODB_URI: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(65535)
  PORT: number = 4000;

  // `*` allows every origin. Otherwise a comma-separated allow-list.
  @IsOptional()
  @IsString()
  FRONTEND_URL: string = '*';

  @IsOptional()
  @IsString()
  JOB_SECRET?: string;

  @IsOptional()
  @IsString()
  GEMINI_API_KEY?: string;

  @IsOptional()
  @IsString()
  GEMINI_API_KEY_2?: string;

  @IsOptional()
  @IsString()
  GEMINI_API_KEY_3?: string;

  @IsOptional()
  @IsString()
  GEMINI_MODEL: string = 'gemini-3.5-flash-lite';

  @IsOptional()
  @IsString()
  GEMINI_FALLBACK_MODEL: string = 'gemini-3.1-flash-lite';

  @IsOptional()
  @IsIn(['true', 'false'])
  ALLOW_CHANGE_SIMULATION?: string;

  @IsOptional()
  @IsString()
  NODE_ENV?: string;
}

export function validateEnv(config: Record<string, unknown>): Env {
  const env = plainToInstance(Env, config, { enableImplicitConversion: true });
  const errors = validateSync(env);

  if (errors.length > 0) {
    const details = errors
      .flatMap((error) => Object.values(error.constraints ?? {}))
      .map((message) => `  - ${message}`)
      .join('\n');
    throw new Error(`Invalid environment variables:\n${details}`);
  }

  return env;
}
