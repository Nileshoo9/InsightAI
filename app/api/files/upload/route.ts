import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { fail, ok } from "@/lib/http";
import { requireAuth } from "@/lib/require-auth";
import {
  mapRowsToRecords,
  parseCsvRows,
  parseExcelRows
} from "@/lib/services/parser";

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB
const ALLOWED_EXTENSIONS = [".csv", ".xls", ".xlsx"];

function sanitizeFileName(name: string): string {
  return name.replace(/[^a-zA-Z0-9._\-\s]/g, "_").trim();
}

export async function POST(req: NextRequest) {
  try {
    const { session, error } = await requireAuth(req);
    if (error || !session) return error || fail("Unauthorized", 401);

    const formData = await req.formData();
    const file = formData.get("file");
    if (!(file instanceof File)) return fail("File is required", 400);

    /* Size check */
    if (file.size > MAX_FILE_SIZE) {
      return fail(`File too large. Maximum size is ${MAX_FILE_SIZE / 1024 / 1024}MB.`, 400);
    }

    /* Extension check */
    const name = file.name.toLowerCase();
    const ext = name.substring(name.lastIndexOf("."));
    if (!ALLOWED_EXTENSIONS.includes(ext)) {
      return fail("Unsupported file type. Use CSV (.csv) or Excel (.xls, .xlsx).", 400);
    }

    /* MIME type check */
    const validMimes = [
      "text/csv",
      "application/vnd.ms-excel",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "application/octet-stream",
      ""
    ];
    if (file.type && !validMimes.includes(file.type)) {
      return fail("Invalid file MIME type.", 400);
    }

    let rawRows;
    if (ext === ".csv") {
      const text = await file.text();
      rawRows = parseCsvRows(text);
    } else {
      const buffer = await file.arrayBuffer();
      rawRows = parseExcelRows(buffer);
    }

    if (!rawRows.length) return fail("No rows found in file", 400);
    const records = mapRowsToRecords(rawRows);
    const safeName = sanitizeFileName(file.name);

    const createdFile = await prisma.file.create({
      data: {
        userId: session.userId,
        fileName: safeName,
        rawPreview: rawRows.slice(0, 5000),
        rawRowCount: rawRows.length
      }
    });

    if (records.length) {
      await prisma.dataRecord.createMany({
        data: records.map((r) => ({
          fileId: createdFile.id,
          date: r.date!,
          revenue: r.revenue,
          product: r.product,
          quantity: r.quantity,
          category: r.category,
          customer: r.customer
        }))
      });
    }

    return ok({
      file: createdFile,
      recordCount: records.length,
      rawRowCount: rawRows.length
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to upload file";
    return fail(message, 500);
  }
}
