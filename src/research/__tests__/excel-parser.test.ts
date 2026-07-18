import { afterEach, describe, expect, it, vi } from "vitest";
import { parseExcel } from "../excel-parser.js";

const xlsxMocks = vi.hoisted(() => ({
  fromFileAsync: vi.fn(),
}));

vi.mock("xlsx-populate", () => ({
  default: {
    fromFileAsync: xlsxMocks.fromFileAsync,
  },
}));

afterEach(() => {
  vi.clearAllMocks();
});

describe("parseExcel", () => {
  it("normalizes the first XLSX sheet into research rows", async () => {
    xlsxMocks.fromFileAsync.mockResolvedValue({
      sheet: () => ({
        cell: () => ({ style: () => undefined }),
        name: () => "Survey",
        usedRange: () => ({
          value: () => [
            ["Role", null, "Created", "Summary"],
            [null, null, null, null],
            [
              "Designer",
              42,
              new Date("2026-07-18T00:00:00.000Z"),
              { text: () => "Cached formula result" },
            ],
          ],
        }),
      }),
    });

    await expect(parseExcel("survey.xlsx")).resolves.toEqual({
      sheetName: "Survey",
      headers: ["Role", "Column 2", "Created", "Summary"],
      rows: [[
        "Designer",
        42,
        "2026-07-18T00:00:00.000Z",
        "Cached formula result",
      ]],
      rowCount: 1,
      columnCount: 4,
    });
  });

  it("rejects workbooks that contain no worksheets", async () => {
    xlsxMocks.fromFileAsync.mockResolvedValue({
      sheet: () => undefined,
    });

    await expect(parseExcel("empty.xlsx")).rejects.toThrow(
      "No worksheets found in empty.xlsx",
    );
  });
});
