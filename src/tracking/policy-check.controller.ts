import {
  Controller,
  Headers,
  Param,
  Post,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  ApiHeader,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiServiceUnavailableResponse,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { type Env } from '../config/env.validation.js';
import { PolicyTrackerService } from './policy-tracker.service.js';

@Controller('companies')
@ApiTags('Policy checks')
export class PolicyCheckController {
  constructor(
    private readonly policyTracker: PolicyTrackerService,
    private readonly config: ConfigService<Env, true>,
  ) {}

  @Post(':slug/check')
  @ApiOperation({
    summary: 'Fetch and check a company policy now',
    description:
      'Creates the first baseline version, reports unchanged content, or stores a new version and change when policy text differs.',
  })
  @ApiParam({ name: 'slug', example: 'whatsapp' })
  @ApiHeader({
    name: 'x-job-secret',
    required: true,
    description: 'Must match the configured JOB_SECRET environment variable.',
  })
  @ApiOkResponse({
    description: 'Result of the policy check.',
    schema: {
      type: 'object',
      properties: {
        companySlug: { type: 'string', example: 'whatsapp' },
        status: {
          type: 'string',
          enum: ['baseline', 'unchanged', 'changed', 'skipped'],
        },
        fetchedAt: { type: 'string', format: 'date-time' },
        changeId: { type: 'string' },
      },
    },
  })
  @ApiUnauthorizedResponse({
    description: 'The job secret is missing or invalid.',
  })
  @ApiServiceUnavailableResponse({
    description: 'JOB_SECRET is not configured or the policy check failed.',
  })
  @ApiNotFoundResponse({
    description: 'No active company exists with this slug.',
  })
  async checkCompany(
    @Param('slug') slug: string,
    @Headers('x-job-secret') suppliedSecret?: string,
  ) {
    const expectedSecret = this.config.get('JOB_SECRET', { infer: true });
    if (!expectedSecret) {
      throw new ServiceUnavailableException(
        'Manual policy checks are disabled until JOB_SECRET is configured',
      );
    }
    if (suppliedSecret !== expectedSecret) {
      throw new UnauthorizedException('Invalid job secret');
    }

    return this.policyTracker.checkCompany(slug);
  }

  @Post(':slug/simulate-change')
  @ApiOperation({
    summary: 'Simulate a policy change for the test company',
    description:
      'Development-only. Only test-company is accepted. Fetches that company live policy, compares it with the predefined earlier fixture, and stores both versions and the resulting change as sample data. Does not update daily check status.',
  })
  @ApiParam({ name: 'slug', example: 'test-company' })
  @ApiHeader({
    name: 'x-job-secret',
    required: true,
    description: 'Must match the configured JOB_SECRET environment variable.',
  })
  @ApiOkResponse({ description: 'Sample change and AI analysis result.' })
  @ApiUnauthorizedResponse({
    description: 'The job secret is missing or invalid.',
  })
  @ApiServiceUnavailableResponse({
    description:
      'Simulation is disabled or the live policy could not be fetched.',
  })
  @ApiNotFoundResponse({
    description: 'No active company exists with this slug.',
  })
  async simulateChange(
    @Param('slug') slug: string,
    @Headers('x-job-secret') suppliedSecret?: string,
  ) {
    const expectedSecret = this.config.get('JOB_SECRET', { infer: true });
    if (!expectedSecret) {
      throw new ServiceUnavailableException(
        'Policy simulations are disabled until JOB_SECRET is configured',
      );
    }
    if (suppliedSecret !== expectedSecret) {
      throw new UnauthorizedException('Invalid job secret');
    }

    const enabled = this.config.get('ALLOW_CHANGE_SIMULATION', {
      infer: true,
    });
    const environment = this.config.get('NODE_ENV', { infer: true });
    if (enabled !== 'true' || environment === 'production') {
      throw new ServiceUnavailableException(
        'Change simulation is disabled; enable ALLOW_CHANGE_SIMULATION=true in non-production only',
      );
    }

    return this.policyTracker.simulateChange(slug);
  }
}
