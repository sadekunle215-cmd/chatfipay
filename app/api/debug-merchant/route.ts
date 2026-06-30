import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/firebaseAdmin";

export async function GET(req: NextRequest) {
  const snap = await db.collection("merchants").limit(10).get();
  const docs = snap.docs.map(d => ({ id: d.id, data: d.data() }));
  return NextResponse.json({ count: snap.size, docs });
}
