import { ApiProperty } from '@nestjs/swagger';
import { PaginationMetaDto } from '../../common/dto/pagination.dto';

export class TransactionAggregatesDto {
  @ApiProperty({ example: '45231000.00', description: 'Total volume in USD' })
  totalVolumeUsd: string;

  @ApiProperty({ example: '678465.00', description: 'Total fees collected in USD' })
  totalFeesUsd: string;

  @ApiProperty({
    example: {
      PENDING_CONFIRMATION: 12,
      CONFIRMED: 45,
      SETTLEMENT_PENDING: 230,
      SETTLED: 151890,
      FAILED: 198,
      REFUNDED: 55,
    },
    description: 'Count of transactions by status',
  })
  countByStatus: Record<string, number>;
}

export class ListTransactionsResponseDto<T = any> {
  @ApiProperty({ type: 'array', description: 'List of transactions' })
  data: T[];

  @ApiProperty({ type: PaginationMetaDto, description: 'Pagination metadata' })
  meta: PaginationMetaDto;

  @ApiProperty({ type: TransactionAggregatesDto, description: 'Aggregate statistics' })
  aggregates: TransactionAggregatesDto;
}

export class TransactionExportJobResponseDto {
  @ApiProperty({ example: 'uuid', description: 'Job ID for tracking export progress' })
  jobId: string;

  @ApiProperty({ example: 152430, description: 'Estimated number of records to export' })
  estimatedRecords: number;
}
