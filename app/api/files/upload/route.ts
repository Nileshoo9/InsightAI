import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { fail, ok } from "@/lib/http";
import { requireAuth } from "@/lib/require-auth";
import { isDatabaseUnavailableError } from "@/lib/db-errors";
import { parseCsvRows, parseExcelRows, parseExcelWorkbook, parseJsonRows } from "@/lib/services/parser";

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB
const ALLOWED_EXTENSIONS = [".csv", ".xls", ".xlsx", ".json"];

function sanitizeFileName(name: string): string {
  return name.replace(/[^a-zA-Z0-9._\-\s]/g, "_").trim();
}

export async function POST(req: NextRequest) {
  try {
    const { session, error } = await requireAuth(req);
    if (error || !session) return error || fail("Unauthorized", 401);

    const formData = await req.formData();
    const file = formData.get("file");
    const selectedSheet = formData.get("sheetName");
    if (!(file instanceof File)) return fail("File is required", 400);

    /* Size check */
    if (file.size > MAX_FILE_SIZE) {
      return fail(`File too large. Maximum size is ${MAX_FILE_SIZE / 1024 / 1024}MB.`, 400);
    }

    /* Extension check */
    const name = file.name.toLowerCase();
    const ext = name.substring(name.lastIndexOf("."));
    if (!ALLOWED_EXTENSIONS.includes(ext)) {
      return fail("Unsupported file type. Use CSV, Excel, or JSON.", 400);
    }

    /* MIME type check */
    const validMimes = [
      "text/csv",
      "application/vnd.ms-excel",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "application/json",
      "application/octet-stream",
      ""
    ];
    if (file.type && !validMimes.includes(file.type)) {
      return fail("Invalid file MIME type.", 400);
    }

    let rawRows;
    let sheets: { name: string; rowCount: number }[] | undefined;
    if (ext === ".csv") {
      const text = await file.text();
      rawRows = parseCsvRows(text);
    } else if (ext === ".json") {
      rawRows = parseJsonRows(await file.text());
    } else {
      const buffer = await file.arrayBuffer();
      const workbook = parseExcelWorkbook(buffer);
      sheets = workbook.map((sheet) => ({ name: sheet.name, rowCount: sheet.rows.length }));
      rawRows = parseExcelRows(buffer, typeof selectedSheet === "string" ? selectedSheet : undefined);
    }

    if (!rawRows.length) return fail("No rows found in file", 400);
    const safeName = sanitizeFileName(file.name);

    // Ensure a matching User row exists for the session.userId (DB was recently reset in some environments)
    const existingUser = await prisma.user.findUnique({ where: { id: session.userId } });
    if (!existingUser) {
      // Create a lightweight user record so foreign key constraints succeed. Password is empty - this is a dev convenience.
      await prisma.user.create({ data: { id: session.userId, email: (session as any).email || `${session.userId}@local`, password: "" } });
    }

    const createdFile = await prisma.file.create({
      data: {
        userId: session.userId,
        fileName: safeName,
        rawPreview: rawRows.slice(0, 5000),
        rawRowCount: rawRows.length
      }
    });

    // Create a dataset for this upload (one dataset per uploaded file by default)
    const datasetName = safeName.replace(/\.[^.]+$/, "");
    const createdDataset = await prisma.dataset.create({
      data: {
        userId: session.userId,
        name: datasetName,
        description: "Uploaded dataset",
        sourceType: ext.replace(/^\./, "")
      }
    });

    // Link the File to DatasetFile
    await prisma.datasetFile.create({
      data: {
        datasetId: createdDataset.id,
        fileId: createdFile.id,
        mimeType: file.type || undefined,
        fileSize: file.size,
        storagePath: null
      }
    });

    // Create initial DatasetVersion
    const columnCount = rawRows && rawRows.length ? (typeof rawRows[0] === 'object' ? Object.keys(rawRows[0]).length : 0) : 0;
    const createdVersion = await prisma.datasetVersion.create({
      data: {
        datasetId: createdDataset.id,
        version: 1,
        rowCount: rawRows.length,
        columnCount
      }
    });

    return ok({
      file: createdFile,
      dataset: createdDataset,
      datasetVersion: createdVersion,
      recordCount: rawRows.length,
      rawRowCount: rawRows.length,
      sheets
    });
  } catch (error) {
    if (isDatabaseUnavailableError(error)) {
      return fail("Database is temporarily unavailable. Please try again shortly.", 503);
    }
    const message = error instanceof Error ? error.message : "Failed to upload file";
    return fail(message, 500);
  }
}
