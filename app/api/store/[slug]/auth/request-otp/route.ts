import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/firebaseAdmin";
import { Timestamp } from "firebase-admin/firestore";
import { normalizeEmail, generateOtp, hashOtp, sendOtpEmail } from "@/lib/buyerAuth";

// POST /api/store/[slug]/auth/request-otp — body: { email }
export async function POST(req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  try {
    const body = await req.json();
    const email = normalizeEmail(body.email);
    if (!email) return NextResponse.json({ error: "Valid email required" }, { status: 400 });

    const storeSnap = await db.collection("stores").doc(slug).get();
    if (!storeSnap.exists) return NextResponse.json({ error: "Store not found" }, { status: 404 });
    const store = storeSnap.data()!;

    const otp = generateOtp();
    const salt = process.env.BUYER_AUTH_SECRET || "chatfi";
    const otpHash = hashOtp(otp, salt);
    const now = Timestamp.now();
    const expiresAt = Timestamp.fromMillis(now.toMillis() + 5 * 60 * 1000);

    await db.collection("stores").doc(slug).collection("otps").doc(email).set({
      otpHash,
      expiresAt,
      attempts: 0,
      createdAt: now,
    });

    await sendOtpEmail(email, otp, store.name || slug);

    const response = NextResponse.json({ success: true });
    response.headers.set("Access-Control-Allow-Origin", "*");
    return response;
  } catch (e: any) {
    console.error(e);
    return NextResponse.json({ error: e.message || "Server error" }, { status: 500 });
  }
}

export async function OPTIONS() {
  return new Response(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    },
  });
}
