import fs from 'node:fs';

export type SqlTupleValue = string | number | null;

/**
 * Parses values from phpMyAdmin-style `INSERT INTO ... VALUES (...), (...);` statements.
 * Handles single-quoted strings with backslash escapes (`\'`, `\\`) and doubled quotes (`''`),
 * commas inside quoted strings, NULL literals, and numeric literals.
 */
export function parseMysqlInsertTuples(
  sqlText: string,
  tableName: string,
): SqlTupleValue[][] {
  const results: SqlTupleValue[][] = [];
  const headerRe = new RegExp(
    `INSERT\\s+INTO\\s+\`?${tableName}\`?[^;]*?VALUES\\s*`,
    'gi',
  );

  let match: RegExpExecArray | null;
  while ((match = headerRe.exec(sqlText)) !== null) {
    let i = match.index + match[0].length;
    const len = sqlText.length;

    while (i < len) {
      // Skip whitespace and commas between tuples
      while (i < len && (sqlText[i] === ' ' || sqlText[i] === '\t' || sqlText[i] === '\r' || sqlText[i] === '\n' || sqlText[i] === ',')) {
        i++;
      }
      if (i >= len || sqlText[i] === ';') {
        i++;
        break;
      }
      if (sqlText[i] !== '(') {
        break;
      }
      i++; // consume '('

      const tuple: SqlTupleValue[] = [];
      while (i < len) {
        // Skip leading whitespace
        while (i < len && (sqlText[i] === ' ' || sqlText[i] === '\t' || sqlText[i] === '\r' || sqlText[i] === '\n')) {
          i++;
        }
        if (i >= len) break;

        if (sqlText[i] === ')') {
          i++; // consume ')'
          break;
        }

        if (sqlText[i] === "'") {
          i++; // consume opening quote
          let str = '';
          while (i < len) {
            const ch = sqlText[i];
            if (ch === '\\' && i + 1 < len) {
              const next = sqlText[i + 1];
              if (next === 'n') str += '\n';
              else if (next === 'r') str += '\r';
              else if (next === 't') str += '\t';
              else str += next;
              i += 2;
            } else if (ch === "'" && sqlText[i + 1] === "'") {
              str += "'";
              i += 2;
            } else if (ch === "'") {
              i++; // consume closing quote
              break;
            } else {
              str += ch;
              i++;
            }
          }
          tuple.push(str);
        } else {
          let token = '';
          while (i < len && sqlText[i] !== ',' && sqlText[i] !== ')') {
            token += sqlText[i];
            i++;
          }
          const trimmed = token.trim();
          if (trimmed.toUpperCase() === 'NULL' || trimmed === '') {
            tuple.push(null);
          } else {
            const num = Number(trimmed);
            tuple.push(Number.isFinite(num) ? num : trimmed);
          }
        }

        // Skip whitespace after value
        while (i < len && (sqlText[i] === ' ' || sqlText[i] === '\t' || sqlText[i] === '\r' || sqlText[i] === '\n')) {
          i++;
        }
        if (sqlText[i] === ',') {
          i++;
        } else if (sqlText[i] === ')') {
          i++;
          break;
        }
      }

      if (tuple.length > 0) {
        results.push(tuple);
      }
    }

    headerRe.lastIndex = i;
  }

  return results;
}

export interface ParsedDistrict {
  id: number;
  districtName: string;
  districtStateSl: number;
}

export interface ParsedTaluk {
  id: number;
  talukDistrictId: number;
  talukName: string;
  del: number;
}

export interface ParsedVillage {
  id: number;
  villTaluksl: number;
  villName: string;
  del: number;
}

export function loadGeographyFromDumps(paths: {
  districtsPath: string;
  taluksPath: string;
  villagesPath: string;
}): {
  districts: ParsedDistrict[];
  taluks: ParsedTaluk[];
  villages: ParsedVillage[];
} {
  const districts: ParsedDistrict[] = [];
  const taluks: ParsedTaluk[] = [];
  const villages: ParsedVillage[] = [];

  if (fs.existsSync(paths.districtsPath)) {
    const raw = fs.readFileSync(paths.districtsPath, 'utf8');
    const tuples = parseMysqlInsertTuples(raw, 'districts');
    for (const row of tuples) {
      const id = Number(row[0]);
      const stateSl = Number(row[2]);
      const name = typeof row[4] === 'string' ? row[4].trim() : '';
      if (Number.isInteger(id) && stateSl === 16 && name) {
        districts.push({ id, districtName: name, districtStateSl: stateSl });
      }
    }
  }

  if (fs.existsSync(paths.taluksPath)) {
    const raw = fs.readFileSync(paths.taluksPath, 'utf8');
    const tuples = parseMysqlInsertTuples(raw, 'taluks');
    for (const row of tuples) {
      const id = Number(row[0]);
      const distId = Number(row[3]);
      const name = typeof row[7] === 'string' ? row[7].trim() : '';
      const del = Number(row[14] ?? 0);
      if (Number.isInteger(id) && Number.isInteger(distId) && name) {
        taluks.push({ id, talukDistrictId: distId, talukName: name, del: Number.isFinite(del) ? del : 0 });
      }
    }
  }

  if (fs.existsSync(paths.villagesPath)) {
    const raw = fs.readFileSync(paths.villagesPath, 'utf8');
    const tuples = parseMysqlInsertTuples(raw, 'villages');
    for (const row of tuples) {
      const id = Number(row[0]);
      const talukId = Number(row[4]);
      const name = typeof row[13] === 'string' ? row[13].trim() : '';
      const del = Number(row[22] ?? 0);
      if (Number.isInteger(id) && Number.isInteger(talukId) && name) {
        villages.push({ id, villTaluksl: talukId, villName: name, del: Number.isFinite(del) ? del : 0 });
      }
    }
  }

  return { districts, taluks, villages };
}
