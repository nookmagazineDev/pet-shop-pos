// Make Supabase rows look exactly like the rows the old Google Sheets API
// returned, so every page keeps working without changes:
//  - empty cells were "" (Postgres gives null)
//  - JSON columns were strings the pages JSON.parse() themselves
//  - dates were ISO strings ending in "Z"
//  - there was no surrogate "id" column

const JSON_COLS = new Set(["CartDetails", "CustomerInfo", "DetailsJSON", "ItemsJSON"]);
const HIDDEN_COLS = new Set(["id", "AuthUserID"]);
const PG_TIMESTAMP = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?\+00:00$/;

export function toSheetRow(row) {
  const out = {};
  for (const [key, value] of Object.entries(row)) {
    if (HIDDEN_COLS.has(key)) continue;
    if (value === null || value === undefined) out[key] = "";
    else if (JSON_COLS.has(key) && typeof value === "object") out[key] = JSON.stringify(value);
    else if (typeof value === "string" && PG_TIMESTAMP.test(value)) out[key] = new Date(value).toISOString();
    else out[key] = value;
  }
  return out;
}
