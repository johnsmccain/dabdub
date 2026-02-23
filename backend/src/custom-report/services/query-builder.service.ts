import { Injectable, BadRequestException } from '@nestjs/common';
import { DataSource, SelectQueryBuilder } from 'typeorm';
import {
  ReportDataSource,
  ReportColumn,
  ReportFilter,
  ReportSort,
} from '../enums/report.enums';
import { getAllowedFields, resolveField } from './field-whitelist';

/** Max rows before we refuse to run synchronously (preview cap: 20) */
export const PREVIEW_LIMIT = 20;
export const RUN_ROW_LIMIT = 500_000;

@Injectable()
export class QueryBuilderService {
  constructor(private readonly dataSource: DataSource) {}

  /**
   * Validates that every field in columns, filters, and sorting is whitelisted.
   * Throws BadRequestException with detail if any field is invalid.
   */
  validateFields(
    dataSource: ReportDataSource,
    columns: ReportColumn[],
    filters: ReportFilter[],
    sorting: ReportSort[],
  ): void {
    const allowed = new Set(getAllowedFields(dataSource));

    const invalid: string[] = [];

    for (const col of columns) {
      if (!allowed.has(col.field)) invalid.push(`column: "${col.field}"`);
    }
    for (const f of filters) {
      if (!allowed.has(f.field)) invalid.push(`filter: "${f.field}"`);
    }
    for (const s of sorting) {
      if (!allowed.has(s.field)) invalid.push(`sort: "${s.field}"`);
    }

    if (invalid.length > 0) {
      throw new BadRequestException(
        `Invalid fields for data source ${dataSource}: ${invalid.join(', ')}. ` +
          `Allowed fields: ${[...allowed].join(', ')}`,
      );
    }
  }

  /**
   * Builds a fully parameterized TypeORM QueryBuilder from a SavedReport definition.
   * Never interpolates user-supplied field names — all field names come from the whitelist.
   */
  buildQuery(
    ds: ReportDataSource,
    columns: ReportColumn[],
    filters: ReportFilter[],
    sorting: ReportSort[],
  ): SelectQueryBuilder<any> {
    const qb = this.getBaseQuery(ds);
    const includedColumns = columns.filter((c) => c.include);

    // ── SELECT ────────────────────────────────────────────────────────────────
    if (includedColumns.length > 0) {
      qb.select(
        includedColumns.map(
          (c) => `${resolveField(ds, c.field)} AS "${c.alias}"`,
        ),
      );
    }

    // ── WHERE ─────────────────────────────────────────────────────────────────
    filters.forEach((f, idx) => {
      const col = resolveField(ds, f.field)!;
      const paramKey = `fp${idx}`;

      switch (f.operator) {
        case 'eq':
          qb.andWhere(`${col} = :${paramKey}`, { [paramKey]: f.value });
          break;
        case 'neq':
          qb.andWhere(`${col} != :${paramKey}`, { [paramKey]: f.value });
          break;
        case 'gt':
          qb.andWhere(`${col} > :${paramKey}`, { [paramKey]: f.value });
          break;
        case 'lt':
          qb.andWhere(`${col} < :${paramKey}`, { [paramKey]: f.value });
          break;
        case 'gte':
          qb.andWhere(`${col} >= :${paramKey}`, { [paramKey]: f.value });
          break;
        case 'lte':
          qb.andWhere(`${col} <= :${paramKey}`, { [paramKey]: f.value });
          break;
        case 'contains':
          qb.andWhere(`${col} ILIKE :${paramKey}`, {
            [paramKey]: `%${String(f.value)}%`,
          });
          break;
        case 'in':
          qb.andWhere(`${col} IN (:...${paramKey})`, {
            [paramKey]: Array.isArray(f.value) ? f.value : [f.value],
          });
          break;
      }
    });

    // ── ORDER BY ──────────────────────────────────────────────────────────────
    sorting.forEach((s, idx) => {
      const col = resolveField(ds, s.field)!;
      if (idx === 0) {
        qb.orderBy(col, s.direction);
      } else {
        qb.addOrderBy(col, s.direction);
      }
    });

    return qb;
  }

  /** Count matching rows — used before enqueuing full export. */
  async countRows(
    ds: ReportDataSource,
    columns: ReportColumn[],
    filters: ReportFilter[],
    sorting: ReportSort[],
  ): Promise<number> {
    const qb = this.buildQuery(ds, columns, filters, sorting);
    return qb.getCount();
  }

  /** Returns first `limit` rows as plain objects — for preview endpoint. */
  async preview(
    ds: ReportDataSource,
    columns: ReportColumn[],
    filters: ReportFilter[],
    sorting: ReportSort[],
    limit: number = PREVIEW_LIMIT,
  ): Promise<Record<string, unknown>[]> {
    const qb = this.buildQuery(ds, columns, filters, sorting);
    return qb.limit(limit).getRawMany();
  }

  // ── Private: build base query per data source ─────────────────────────────

  private getBaseQuery(ds: ReportDataSource): SelectQueryBuilder<any> {
    const manager = this.dataSource.createEntityManager();

    switch (ds) {
      case ReportDataSource.TRANSACTIONS:
        return manager
          .createQueryBuilder()
          .from('transactions', 't')
          .leftJoin('merchants', 'm', 'm.id = t.payment_request_id')
          .where('t.deleted_at IS NULL');

      case ReportDataSource.MERCHANTS:
        return manager
          .createQueryBuilder()
          .from('merchants', 'm')
          .where('m.deleted_at IS NULL');

      case ReportDataSource.SETTLEMENTS:
        return manager
          .createQueryBuilder()
          .from('settlements', 's')
          .leftJoin('merchants', 'm', 'm.id = s.merchant_id')
          .where('s.deleted_at IS NULL');

      case ReportDataSource.FEES:
        return manager
          .createQueryBuilder()
          .from('merchant_fee_configs', 'mfc')
          .leftJoin('merchants', 'm', 'm.id = mfc.merchant_id')
          .where('mfc.deleted_at IS NULL');

      case ReportDataSource.REFUNDS:
        return manager
          .createQueryBuilder()
          .from('payment_requests', 'pr')
          .leftJoin('merchants', 'm', 'm.id = pr.merchant_id')
          .where("pr.type = 'refund'")
          .andWhere('pr.deleted_at IS NULL');

      case ReportDataSource.AUDIT_LOGS:
        return manager.createQueryBuilder().from('compliance_audit_logs', 'al');

      default:
        throw new BadRequestException(`Unknown data source: ${ds as string}`);
    }
  }
}
