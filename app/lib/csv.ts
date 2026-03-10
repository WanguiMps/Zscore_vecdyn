import Papa, { ParseResult } from "papaparse";
import type { Row } from "./types";

export function parseCsvFile(file: File): Promise<Row[]> {
  return new Promise((resolve, reject) => {
    Papa.parse<Row>(file, {
      header: true,
      dynamicTyping: true,
      skipEmptyLines: true,
      complete: (results: ParseResult<Row>) => {
        const cleanedRows = results.data.filter((row) => {
          const species = row.species?.toString().trim();
          return Boolean(species);
        });
        resolve(cleanedRows);
      },
      error: (error) => {
        reject(error);
      },
    });
  });
}
