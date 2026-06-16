import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/firebase";
import { collection, query, where, getDocs } from "firebase/firestore";

// GET /api/merchant/payments?key=cfp_xxx  OR  ?wallet=xxx
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const key = searchParams.get("key");
    const wallet = searchParams.get("wallet");

    if (!key && !wallet) return NextResponse.json({ error: "Missing key or wallet" }, { status: 400 });

    const field = key ? "apiKey" : "walletAddress";
    const value = (key || wallet) as string;

    const q = query(collection(db, "payments"), where(field, "==", value));
    const snap = await getDocs(q);
    const payments = snap.docs
      .map(d => d.data())
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    const completed = payments.filter(p => p.status === "completed");
    const volume = completed.reduce((sum, p) => sum + (p.amount || 0), 0);

    return NextResponse.json({
      payments,
      stats: {
        total: payments.length,
        completed: completed.length,
        pending: payments.filter(p => p.status === "pending").length,
        volume: Math.round(volume * 1000) / 1000,
      }
    });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
