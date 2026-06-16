import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/firebase";
import { doc, setDoc, getDoc } from "firebase/firestore";

function generateApiKey() {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let key = "cfp_";
  for (let i = 0; i < 32; i++) key += chars.charAt(Math.floor(Math.random() * chars.length));
  return key;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { walletAddress, webhookUrl } = body;
    if (!walletAddress) return NextResponse.json({ error: "Missing walletAddress" }, { status: 400 });

    const key = generateApiKey();
    const record = {
      key,
      createdAt: new Date().toISOString(),
      webhookUrl: webhookUrl || "",
    };

    const snap = await getDoc(doc(db, "merchants", walletAddress));
    const existing = snap.exists() ? snap.data() : {};
    const keyHistory = [record, ...(existing.keyHistory || [])].slice(0, 5);

    await setDoc(doc(db, "merchants", walletAddress), {
      ...existing,
      walletAddress,
      apiKey: key,
      keyHistory,
      updatedAt: new Date().toISOString(),
    }, { merge: true });

    return NextResponse.json({ apiKey: key, keyHistory });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
