import { Writable } from 'stream';
import { stringify } from 'csv-stringify';
import { ExportFormat } from '../enums/export.enums';

export interface ColumnDefinition {
  key: string;
  header: string;
}

/**
 * Wraps a Writable stream (e.g. S3 PassThrough) and exposes a simple
 * writeHeader / writeRows / end interface for streaming exports.
 *
 * For XLSX we buffer rows and write at the end because ExcelJS's streaming
 * writer does not support arbitrary writable destinations without a workaround.
 * The 500k-row cap keeps peak memory well under 512 MB.
 */
export class ExportWriter {
  private csvStringifier: ReturnType<typeof stringify> | null = null;
  // For XLSX we accumulate rows (bounded to ≤500k by business rule)
  private xlsxRows: Record<string, unknown>[] = [];
  private columns: ColumnDefinition[] = [];

  constructor(
    private readonly destination: Writable,
    private readonly format: ExportFormat,
  ) {}

  writeHeader(columns: ColumnDefinition[]): void {
    this.columns = columns;

    if (this.format === ExportFormat.CSV) {
      this.csvStringifier = stringify({
        header: true,
        columns: columns.map((c) => ({ key: c.key, header: c.header })),
      });
      this.csvStringifier.pipe(this.destination);
    }
    // XLSX: headers written during end()
  }

  writeRows(rows: Record<string, unknown>[]): void {
    if (this.format === ExportFormat.CSV) {
      for (const row of rows) {
        this.csvStringifier!.write(row);
      }
    } else {
      this.xlsxRows.push(...rows);
    }
  }

  async end(): Promise<void> {
    if (this.format === ExportFormat.CSV) {
      await new Promise<void>((resolve, reject) => {
        this.csvStringifier!.end(() => resolve());
        this.csvStringifier!.once('error', reject);
      });
    } else {
      await this.writeXlsx();
    }
  }

  private async writeXlsx(): Promise<void> {
    // Dynamic import to avoid mandatory dep if only CSV is used
    const ExcelJS = await import('exceljs');
    const workbook = new ExcelJS.default.Workbook();
    const sheet = workbook.addWorksheet('Export');

    sheet.columns = this.columns.map((c) => ({
      header: c.header,
      key: c.key,
      width: 20,
    }));

    for (const row of this.xlsxRows) {
      sheet.addRow(row);
    }

    // Write to buffer then pipe to destination
    const buffer = await workbook.xlsx.writeBuffer();
    await new Promise<void>((resolve, reject) => {
      this.destination.write(buffer, (err) => {
        if (err) return reject(err);
        this.destination.end();
        resolve();
      });
    });
  }
}
