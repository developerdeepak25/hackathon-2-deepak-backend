import { Controller, Get, Query } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { CompanyService } from './company.service.js';

@Controller('changes')
@ApiTags('Changes')
export class ChangesController {
  constructor(private readonly companyService: CompanyService) {}

  @Get('recent')
  @ApiOperation({
    summary: 'List the newest policy changes across companies',
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    description: 'Number of changes to return. Defaults to 10 and caps at 25.',
    schema: { type: 'integer', minimum: 1, maximum: 25, default: 10 },
  })
  @ApiOkResponse({
    description: 'Recent changes without policy text.',
  })
  async listRecent(@Query('limit') limit?: string) {
    const parsed = limit === undefined ? 10 : Number(limit);
    const safeLimit = Number.isFinite(parsed) ? parsed : 10;
    return this.companyService.listRecentChanges(safeLimit);
  }
}