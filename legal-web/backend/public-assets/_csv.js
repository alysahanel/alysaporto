
import { parse } from 'csv-parse/sync';
import { stringify } from 'csv-stringify/sync';
export function parseCsv(buffer) {
  return parse(buffer.toString('utf8'), { columns: true, skip_empty_lines: true });
}
export function toCsv(rows) { return stringify(rows, { header: true }); }
