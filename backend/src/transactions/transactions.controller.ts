import {
  Controller,
  Get,
  Param,
  Query,
  Res,
  HttpStatus,
  UseGuards,
} from '@nestjs/common';
import { TransactionsService } from './transactions.service';
import { TransactionQueryDto, ListTransactionsQueryDto } from './dto/transaction-query.dto';
import { TransactionDetailResponseDto } from './dto/transaction-detail.dto';
import { ListTransactionsResponseDto, TransactionExportJobResponseDto } from './dto/transaction-list-response.dto';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiQuery,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { Response } from 'express';
import { Readable } from 'stream';

@ApiTags('Transactions')
@Controller('api/v1/transactions')
export class TransactionsController {
  constructor(private readonly transactionsService: TransactionsService) { }

  @Get()
  @ApiOperation({
    summary: 'List transactions with high-performance filtering',
    description: 'Supports filtering, sorting, pagination (offset or cursor-based), aggregates, and async export',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Returns paginated list with aggregates, or export job ID if export=true',
    type: ListTransactionsResponseDto,
  })
  async list(
    @Query() query: ListTransactionsQueryDto,
  ): Promise<ListTransactionsResponseDto | TransactionExportJobResponseDto> {
    return this.transactionsService.listTransactions(query);
  }

  @Get('legacy')
  @ApiOperation({ summary: '[DEPRECATED] Legacy list endpoint - use GET /api/v1/transactions instead' })
  @ApiResponse({ status: HttpStatus.OK, description: 'Return list of transactions.' })
  async findAll(@Query() query: TransactionQueryDto) {
    return this.transactionsService.findAll(query);
  }

  @Get('export')
  @ApiOperation({ summary: 'Export transactions to CSV or PDF' })
  @ApiQuery({ name: 'format', enum: ['csv', 'pdf'], required: true })
  async export(
    @Query() query: TransactionQueryDto,
    @Query('format') format: 'csv' | 'pdf',
    @Res() res: Response,
  ) {
    const data = await this.transactionsService.export(query, format);

    if (format === 'csv') {
      res.set({
        'Content-Type': 'text/csv',
        'Content-Disposition': 'attachment; filename="transactions.csv"',
      });
      (data as Readable).pipe(res);
    } else {
      res.set({
        'Content-Type': 'application/pdf',
        'Content-Disposition': 'attachment; filename="transactions.pdf"',
        'Content-Length': (data as Buffer).length,
      });
      res.end(data);
    }
  }

  @Get('hash/:txHash')
  @ApiOperation({ summary: 'Lookup transaction by hash' })
  async findByHash(@Param('txHash') txHash: string) {
    return this.transactionsService.findByHash(txHash);
  }

  @Get('network/:network')
  @ApiOperation({ summary: 'List transactions for a specific network' })
  async findByNetwork(
    @Param('network') network: string,
    @Query() query: TransactionQueryDto,
  ) {
    query.network = network;
    return this.transactionsService.findAll(query);
  }

  // --- Parameterised routes MUST be after all literal routes to avoid shadowing ---

  @Get(':id')
  @ApiOperation({ summary: 'Get full transaction detail' })
  @ApiResponse({
    status: HttpStatus.OK,
    type: TransactionDetailResponseDto,
    description: 'Full transaction detail including on-chain data, fees, settlement, and webhooks.',
  })
  @ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'Transaction not found.' })
  async getDetail(@Param('id') id: string): Promise<TransactionDetailResponseDto> {
    return this.transactionsService.getDetail(id);
  }

  @Get(':id/confirmations')
  @ApiOperation({ summary: 'Get real-time confirmation count' })
  async getConfirmations(@Param('id') id: string) {
    return this.transactionsService.getConfirmations(id);
  }
}
