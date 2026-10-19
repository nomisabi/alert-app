import { ApiProperty } from '@nestjs/swagger';

// DTO = Data Transfer Object: the shape of the response. The @ApiProperty
// decorators describe it in the OpenAPI spec (which Orval will read later).
export class HealthResponseDto {
  @ApiProperty({ enum: ['ok', 'error'], example: 'ok' })
  status: 'ok' | 'error';

  @ApiProperty({ enum: ['up', 'down'], example: 'up' })
  database: 'up' | 'down';
}
