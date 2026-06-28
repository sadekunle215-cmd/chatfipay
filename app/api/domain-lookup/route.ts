import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/firebaseAdmin";

// GET /api/domain-lookup?domain=shop.example.com — used by chatfistore's middleware
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const domain = searchParams.get("domain")?.toLowerCase();
  if (!domain) return NextResponse.json({ error: "Missing domain" }, { status: 400 });

  try {
    const snap = await db.collection("domainMappings").doc(domain).get();
    if (!snap.exists) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json({ username: snap.data()!.username });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
