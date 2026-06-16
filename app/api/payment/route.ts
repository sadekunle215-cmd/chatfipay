import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/firebase";
import { doc, getDoc, collection, addDoc, serverTimestamp } from "firebase/firestore";
import { nanoid } from "nanoid";

async function validateApiKey(apiKey: string): Promise<string | null> {
  // API key format: cfp_xxxxx, we store them under merchants collection
  const snap = await db
    ? null
    : null;

  // Query merchants for this API key
  const { getDocs, query, where } = await import("firebase/firestore");
  const q = query(collection(db, "merchants"), where("apiKey", "==", apiKey));
  const results = await getDocs(q);
  if (results.empty) return null;
  return results.docs[0].data().walletAddress;
}

export async function POST(req: NextRequest) {
  try {
    const apiKey = req.headers.get("x-api-key");
    if (!apiKey) {
      return NextResponse.json({ error: "Missing x-api-key header" }, { status: 401 });
    }

    const walletAddress = await validateApiKey(apiKey);
    if (!walletAddress) {
      return NextResponse.json({ error: "Invalid API key" }, { status: 403 });
    }

    const body = await req.json();
    const { amount, label, memo } = body;

    if (!label) {
      return NextResponse.json({ error: "label is required" }, { status: 400 });
    }

    const id = nanoid(10);
    await import("firebase/firestore").then(({ setDoc }) =>
      setDoc(doc(db, "payments", id), {
        id,
        walletAddress,
        amount: amount ? parseFloat(amount) : null,
        label,
        memo: memo || "",
        status: "pending",
        createdAt: new Date().toISOString(),
        source: "api",
        apiKey: apiKey,
      })
    );

    const link = `https://chatfipay-z9xh.vercel.app/pay/${id}`;

    return NextResponse.json({
      success: true,
      id,
      link,
      amount: amount || null,
      label,
      status: "pending",
    });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  try {
    const apiKey = req.headers.get("x-api-key");
    if (!apiKey) {
      return NextResponse.json({ error: "Missing x-api-key header" }, { status: 401 });
    }

    const walletAddress = await validateApiKey(apiKey);
    if (!walletAddress) {
      return NextResponse.json({ error: "Invalid API key" }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");
    if (!id) {
      return NextResponse.json({ error: "Missing id parameter" }, { status: 400 });
    }

    const snap = await getDoc(doc(db, "payments", id));
    if (!snap.exists()) {
      return NextResponse.json({ error: "Payment not found" }, { status: 404 });
    }

    const payment = snap.data();
    if (payment.walletAddress !== walletAddress) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    return NextResponse.json({
      id: payment.id,
      amount: payment.amount,
      label: payment.label,
      memo: payment.memo,
      status: payment.status,
      createdAt: payment.createdAt,
      paidAt: payment.paidAt || null,
      txSignature: payment.txSignature || null,
      link: `https://chatfipay-z9xh.vercel.app/pay/${id}`,
    });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
