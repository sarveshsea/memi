declare module "xlsx-populate" {
  interface XlsxCell {
    style(name: string): unknown;
    style(name: string, value: unknown): XlsxCell;
    value(): unknown;
    value(value: unknown): XlsxCell;
  }

  interface XlsxRange {
    value(): unknown[][];
  }

  interface XlsxSheet {
    cell(address: string): XlsxCell;
    cell(row: number, column: number): XlsxCell;
    name(): string;
    usedRange(): XlsxRange | undefined;
  }

  interface XlsxWorkbook {
    sheet(index: number): XlsxSheet | undefined;
    toFileAsync(filePath: string): Promise<void>;
  }

  const XlsxPopulate: {
    fromBlankAsync(): Promise<XlsxWorkbook>;
    fromFileAsync(filePath: string): Promise<XlsxWorkbook>;
    numberToDate(value: number): Date;
  };

  export default XlsxPopulate;
}
