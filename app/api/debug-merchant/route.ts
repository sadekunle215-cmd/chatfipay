import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/firebaseAdmin";

export async function GET(req: NextRequest) {
  const key = req.nextUrl.searchParams.get("key");
  if (!key) return NextResponse.json({ error: "missing key" }, { status: 400 });

  const snap = await db.collection("merchants").where("apiKey", "==", key).get();
  const docs = snap.docs.map(d => ({ id: d.id, data: d.data() }));
  return NextResponse.json({ count: snap.size, docs });
}
