import { Controller, Get } from '@nestjs/common';
import { InjectConnection } from '@nestjs/mongoose';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import mongoose, { type Connection } from 'mongoose';

export interface HealthResponse {
  status: 'ok' | 'degraded';
  db: 'up' | 'down';
  uptime: number;
  timestamp: string;
}

@Controller('health')
@ApiTags('Health')
export class HealthController {
  constructor(@InjectConnection() private readonly connection: Connection) {}

  @Get()
  @ApiOperation({ summary: 'Check API and database availability' })
  @ApiOkResponse({
    description:
      'Health status, database connection state, and process uptime.',
    schema: {
      type: 'object',
      properties: {
        status: { type: 'string', enum: ['ok', 'degraded'] },
        db: { type: 'string', enum: ['up', 'down'] },
        uptime: { type: 'integer', example: 120 },
        timestamp: { type: 'string', format: 'date-time' },
      },
    },
  })
  check(): HealthResponse {
    const dbUp =
      this.connection.readyState === mongoose.ConnectionStates.connected;
    return {
      status: dbUp ? 'ok' : 'degraded',
      db: dbUp ? 'up' : 'down',
      uptime: Math.round(process.uptime()),
      timestamp: new Date().toISOString(),
    };
  }
}
