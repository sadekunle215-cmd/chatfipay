import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/firebase";
import { doc, getDoc, setDoc, collection, query, where, getDocs } from "firebase/firestore";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const wallet = searchParams.get("wallet");
  if (!wallet) return NextResponse.json({ error: "Missing wallet" }, { status: 400 });

  try {
    const snap = await getDoc(doc(db, "merchants", wallet));
    if (!snap.exists()) return NextResponse.json({ apiKey: "", webhookUrl: "", businessName: "", keyHistory: [], stats: { completed: 0, pending: 0, volume: 0 } });

    const data = snap.data();

    // Calculate real stats
    const q = query(collection(db, "payments"), where("walletAddress", "==", wallet));
    const paySnap = await getDocs(q);
    const payments = paySnap.docs.map(d => d.data());
    const completed = payments.filter(p => p.status === "completed");
    const pending = payments.filter(p => p.status === "pending");
    const volume = completed.reduce((sum: number, p: any) => sum + (p.amount || 0), 0);

    return NextResponse.json({
      apiKey: data.apiKey || "",
      webhookUrl: data.webhookUrl || "",
      businessName: data.businessName || "",
      keyHistory: data.keyHistory || [],
      stats: {
        completed: completed.length,
        pending: pending.length,
        volume: Math.round(volume * 1000) / 1000,
      }
    });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { walletAddress, businessName, webhookUrl, apiKey, keyHistory } = body;
    if (!walletAddress) return NextResponse.json({ error: "Missing walletAddress" }, { status: 400 });

    await setDoc(doc(db, "merchants", walletAddress), {
      walletAddress,
      businessName: businessName || "",
      webhookUrl: webhookUrl || "",
      apiKey: apiKey || "",
      keyHistory: keyHistory || [],
      updatedAt: new Date().toISOString(),
    }, { merge: true });

    return NextResponse.json({ success: true });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
