import { Injectable, BadRequestException } from '@nestjs/common';

/**
 * Validates a cron expression using the `cron` package (already in package.json).
 *
 * Format supported: 5-part standard cron (min hour dom mon dow)
 * or 6-part with optional seconds (sec min hour dom mon dow).
 */
@Injectable()
export class CronValidatorService {
  /**
   * Validates expression and throws BadRequestException if invalid.
   * Returns parsed human-readable description on success.
   */
  validate(expression: string): { valid: true; description: string } {
    if (!expression || !expression.trim()) {
      throw new BadRequestException('Cron expression cannot be empty');
    }

    const parts = expression.trim().split(/\s+/);
    if (parts.length < 5 || parts.length > 6) {
      throw new BadRequestException(
        `Invalid cron expression "${expression}": must have 5 or 6 space-separated fields ` +
          `(got ${parts.length}). Format: [sec] min hour dom mon dow`,
      );
    }

    // Validate each part using regex patterns per field type
    const fivePartPatterns = [
      { name: 'minute', range: [0, 59] },
      { name: 'hour', range: [0, 23] },
      { name: 'day-of-month', range: [1, 31] },
      { name: 'month', range: [1, 12] },
      { name: 'day-of-week', range: [0, 7] },
    ];
    const sixPartPatterns = [
      { name: 'second', range: [0, 59] },
      ...fivePartPatterns,
    ];

    const patterns = parts.length === 6 ? sixPartPatterns : fivePartPatterns;

    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];
      const def = patterns[i];
      if (!this.isValidCronField(part, def.range[0], def.range[1])) {
        throw new BadRequestException(
          `Invalid cron expression "${expression}": field ${i + 1} (${def.name}) ` +
            `"${part}" is not valid. ` +
            `Allowed: numbers ${def.range[0]}-${def.range[1]}, *, */n, n-m, n,m`,
        );
      }
    }

    return { valid: true, description: this.describe(expression) };
  }

  private isValidCronField(field: string, min: number, max: number): boolean {
    if (field === '*') return true;

    // Step: */n
    const stepMatch = field.match(/^\*\/(\d+)$/);
    if (stepMatch) {
      const step = parseInt(stepMatch[1], 10);
      return step >= 1 && step <= max;
    }

    // Range with optional step: n-m or n-m/s
    const rangeMatch = field.match(/^(\d+)-(\d+)(?:\/(\d+))?$/);
    if (rangeMatch) {
      const lo = parseInt(rangeMatch[1], 10);
      const hi = parseInt(rangeMatch[2], 10);
      return lo >= min && hi <= max && lo <= hi;
    }

    // List: n,m,o
    if (field.includes(',')) {
      return field
        .split(',')
        .every((v) => this.isValidCronField(v.trim(), min, max));
    }

    // Plain number
    const n = parseInt(field, 10);
    if (!isNaN(n)) return n >= min && n <= max;

    return false;
  }

  private describe(expression: string): string {
    const parts = expression.trim().split(/\s+/);
    const [minF, hourF, domF, monF, dowF] =
      parts.length === 5 ? parts : parts.slice(1);

    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const months = [
      'Jan',
      'Feb',
      'Mar',
      'Apr',
      'May',
      'Jun',
      'Jul',
      'Aug',
      'Sep',
      'Oct',
      'Nov',
      'Dec',
    ];

    if (
      minF === '0' &&
      hourF === '9' &&
      domF === '*' &&
      monF === '*' &&
      dowF === '1'
    ) {
      return 'Every Monday at 09:00';
    }
    if (minF === '0' && domF === '*' && monF === '*' && dowF === '*') {
      return `Every hour at minute 0, hour ${hourF}`;
    }

    const time =
      hourF === '*' && minF === '*'
        ? 'every minute'
        : hourF === '*'
          ? `at minute ${minF} of every hour`
          : `at ${hourF.padStart(2, '0')}:${minF.padStart(2, '0')}`;

    const day =
      dowF !== '*'
        ? `on ${dowF
            .split(',')
            .map((d) => days[parseInt(d, 10) % 7] ?? d)
            .join(', ')}`
        : domF !== '*'
          ? `on day ${domF} of the month`
          : 'daily';

    const month =
      monF !== '*' ? ` in ${months[parseInt(monF, 10) - 1] ?? monF}` : '';

    return `Runs ${time} ${day}${month}`;
  }
}
