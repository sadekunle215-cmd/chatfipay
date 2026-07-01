import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/firebaseAdmin";
import { Timestamp } from "firebase-admin/firestore";
import { normalizeEmail, hashOtp, signBuyerToken } from "@/lib/buyerAuth";

const MAX_ATTEMPTS = 5;

// POST /api/store/[slug]/auth/verify-otp — body: { email, code }
export async function POST(req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  try {
    const body = await req.json();
    const email = normalizeEmail(body.email);
    const code = (body.code || "").trim();
    if (!email || !code) return NextResponse.json({ error: "Email and code required" }, { status: 400 });

    const otpRef = db.collection("stores").doc(slug).collection("otps").doc(email);
    const otpSnap = await otpRef.get();
    if (!otpSnap.exists) return NextResponse.json({ error: "No OTP requested for this email" }, { status: 400 });

    const otpData = otpSnap.data()!;
    const now = Timestamp.now();

    if (otpData.expiresAt.toMillis() < now.toMillis()) {
      return NextResponse.json({ error: "OTP expired, request a new one" }, { status: 400 });
    }
    if ((otpData.attempts || 0) >= MAX_ATTEMPTS) {
      return NextResponse.json({ error: "Too many attempts, request a new OTP" }, { status: 429 });
    }

    const salt = process.env.BUYER_AUTH_SECRET || "chatfi";
    const expectedHash = hashOtp(code, salt);

    if (expectedHash !== otpData.otpHash) {
      await otpRef.update({ attempts: (otpData.attempts || 0) + 1 });
      return NextResponse.json({ error: "Invalid OTP" }, { status: 400 });
    }

    await otpRef.delete();

    const token = signBuyerToken(slug, email);

    const response = NextResponse.json({ success: true, token, email });
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
