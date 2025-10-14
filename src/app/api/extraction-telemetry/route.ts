import { NextRequest, NextResponse } from "next/server";
import database from "@/lib/config";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { url, attempted, success, method, failure_reason, status_from_api } = body || {};
    if (!url || typeof attempted !== 'boolean' || typeof success !== 'boolean') {
      return NextResponse.json({ success: false, error: 'Invalid payload' }, { status: 400 });
    }
    await database.$executeRawUnsafe(
      `INSERT INTO extraction_telemetry (id, url, attempted, success, method, failure_reason, status_from_api, "createdAt")
       VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6, now())`,
      url,
      attempted,
      success,
      method || null,
      failure_reason || null,
      status_from_api || null
    );
    return NextResponse.json({ success: true });
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e?.message || 'Server error' }, { status: 500 });
  }
}


