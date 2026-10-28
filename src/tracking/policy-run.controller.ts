import {
  Controller,
  Headers,
  Post,
  Query,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  ApiHeader,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiQuery,
  ApiServiceUnavailableResponse,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { type Env } from '../config/env.validation.js';
import { PolicyRunService } from './policy-run.service.js';

@Controller('jobs')
@ApiTags('Policy checks')
export class PolicyRunController {
  constructor(
    private readonly policyRunService: PolicyRunService,
    private readonly config: ConfigService<Env, true>,
  ) {}

  @Post('run')
  @ApiOperation({
    summary: 'Run policy checks for all active companies',
    description:
      'Checks active companies sequentially and stores run totals and per-company errors. Optionally limit the run to one company slug.',
  })
  @ApiQuery({
    name: 'company',
    required: false,
    description: 'Optional company slug to check only one company.',
    example: 'whatsapp',
  })
  @ApiHeader({
    name: 'x-job-secret',
    required: true,
    description: 'Must match the configured JOB_SECRET environment variable.',
  })
  @ApiOkResponse({
    description:
      'Summary and per-company result of the run, including companies skipped because they were already checked that UTC day.',
  })
  @ApiUnauthorizedResponse({
    description: 'The job secret is missing or invalid.',
  })
  @ApiServiceUnavailableResponse({
    description: 'JOB_SECRET is not configured.',
  })
  @ApiNotFoundResponse({
    description: 'No active company exists with the requested slug.',
  })
  async run(
    @Headers('x-job-secret') suppliedSecret?: string,
    @Query('company') companySlug?: string,
  ) {
    const expectedSecret = this.config.get('JOB_SECRET', { infer: true });
    if (!expectedSecret) {
      throw new ServiceUnavailableException(
        'Policy runs are disabled until JOB_SECRET is configured',
      );
    }
    if (suppliedSecret !== expectedSecret) {
      throw new UnauthorizedException('Invalid job secret');
    }

    return this.policyRunService.run(companySlug);
  }
}
