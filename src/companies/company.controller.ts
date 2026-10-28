import { Controller, Get, Param, Query } from '@nestjs/common';
import {
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { CompanyService } from './company.service.js';

@Controller('companies')
@ApiTags('Companies')
export class CompanyController {
  constructor(private readonly companyService: CompanyService) {}

  @Get()
  @ApiOperation({ summary: 'List active tracked companies' })
  @ApiOkResponse({
    description:
      'Active companies and their change counts for the current UTC day.',
    schema: {
      type: 'object',
      properties: {
        total: { type: 'integer', example: 10 },
        companies: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              id: { type: 'string', example: '66f1a9b23d7a2e4b8c10d123' },
              slug: { type: 'string', example: 'whatsapp' },
              name: { type: 'string', example: 'WhatsApp' },
              category: { type: 'string', example: 'messaging' },
              policyUrl: {
                type: 'string',
                format: 'uri',
                example: 'https://www.whatsapp.com/legal/privacy-policy',
              },
              isActive: { type: 'boolean', example: true },
              lastCheckedAt: {
                type: 'string',
                format: 'date-time',
                nullable: true,
              },
              lastChangedAt: {
                type: 'string',
                format: 'date-time',
                nullable: true,
              },
              lastFetchStatus: {
                type: 'string',
                enum: ['ok', 'failed', 'never'],
              },
              todayChangeCount: { type: 'integer', example: 1 },
              changeCount: { type: 'integer', example: 3 },
            },
          },
        },
      },
    },
  })
  async listCompanies() {
    return this.companyService.listCompanies();
  }

  @Get(':slug/timeline')
  @ApiOperation({
    summary: 'List a company’s policy versions and changes',
    description:
      'Returns version metadata and change summaries across all dates. Policy text is omitted.',
  })
  @ApiParam({ name: 'slug', example: 'whatsapp' })
  @ApiOkResponse({ description: 'Company timeline, newest first.' })
  @ApiNotFoundResponse({
    description: 'No active company exists with this slug.',
  })
  async getCompanyTimeline(@Param('slug') slug: string) {
    return this.companyService.getCompanyTimeline(slug);
  }

  @Get(':slug/changes/:changeId')
  @ApiOperation({
    summary: 'Get one policy change with capped excerpts',
  })
  @ApiParam({ name: 'slug', example: 'whatsapp' })
  @ApiParam({ name: 'changeId', example: '66f1a9b23d7a2e4b8c10d456' })
  @ApiOkResponse({
    description:
      'Change summary plus capped previous/current excerpts and added or removed spans.',
  })
  @ApiNotFoundResponse({
    description: 'The company or change was not found.',
  })
  async getCompanyChange(
    @Param('slug') slug: string,
    @Param('changeId') changeId: string,
  ) {
    return this.companyService.getCompanyChange(slug, changeId);
  }

  @Get(':slug/changes')
  @ApiOperation({ summary: 'Get a company’s changes for a UTC date' })
  @ApiParam({ name: 'slug', example: 'whatsapp' })
  @ApiQuery({
    name: 'date',
    required: false,
    description: 'UTC date in YYYY-MM-DD format. Defaults to today.',
    schema: { type: 'string', format: 'date', example: '2026-10-19' },
  })
  @ApiOkResponse({
    description: 'Company changes on the requested UTC date, newest first.',
    schema: {
      type: 'object',
      properties: {
        company: {
          type: 'object',
          properties: {
            id: { type: 'string', example: '66f1a9b23d7a2e4b8c10d123' },
            slug: { type: 'string', example: 'whatsapp' },
            name: { type: 'string', example: 'WhatsApp' },
            category: { type: 'string', example: 'messaging' },
            policyUrl: {
              type: 'string',
              format: 'uri',
              example: 'https://www.whatsapp.com/legal/privacy-policy',
            },
          },
        },
        date: { type: 'string', format: 'date', example: '2026-10-19' },
        changes: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              id: { type: 'string', example: '66f1a9b23d7a2e4b8c10d456' },
              detectedAt: { type: 'string', format: 'date-time' },
              summary: { type: 'string' },
              whatItMeansForYou: { type: 'string' },
              importance: {
                type: 'string',
                enum: ['low', 'medium', 'high', 'critical'],
              },
              tags: { type: 'array', items: { type: 'string' } },
              changedSections: { type: 'array', items: { type: 'string' } },
              aiStatus: { type: 'string', enum: ['ok', 'fallback'] },
              isSample: { type: 'boolean', example: true },
              fromVersionText: { type: 'string' },
              toVersionText: { type: 'string' },
            },
          },
        },
      },
    },
  })
  @ApiNotFoundResponse({
    description: 'No active company exists with this slug.',
  })
  async getCompanyChanges(
    @Param('slug') slug: string,
    @Query('date') date?: string,
  ) {
    return this.companyService.getCompanyChanges(slug, date);
  }
}
