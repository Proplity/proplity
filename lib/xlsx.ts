import ExcelJS from 'exceljs';

export async function toXlsx(
  rows: Record<string, unknown>[],
  columns: string[],
  sheetName: string,
): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet(sheetName);
  sheet.columns = columns.map((c) => ({ header: c, key: c, width: 18 }));
  sheet.addRows(rows);
  sheet.getRow(1).font = { bold: true };
  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}

// Reads the first worksheet's first row as headers, every subsequent row as
// a record keyed by those headers -- mirrors parseCsv's output shape so
// import routes can share the same row-validation code for either format.
export async function parseXlsx(buffer: Buffer): Promise<Record<string, string>[]> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer);
  const sheet = workbook.worksheets[0];
  if (!sheet) return [];

  const headerRow = sheet.getRow(1);
  const headers: string[] = [];
  headerRow.eachCell({ includeEmpty: false }, (cell, colNumber) => {
    headers[colNumber] = String(cell.value ?? '');
  });

  const rows: Record<string, string>[] = [];
  sheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return;
    const record: Record<string, string> = {};
    row.eachCell({ includeEmpty: false }, (cell, colNumber) => {
      const header = headers[colNumber];
      if (header) record[header] = cell.value == null ? '' : String(cell.value);
    });
    if (Object.keys(record).length > 0) rows.push(record);
  });
  return rows;
}
