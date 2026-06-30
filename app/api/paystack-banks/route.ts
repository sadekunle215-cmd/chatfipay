import { NextResponse } from "next/server";

const PAYSTACK_SECRET_KEY = process.env.PAYSTACK_SECRET_KEY as string;

// GET /api/paystack-banks — list of Nigerian banks Paystack supports
export async function GET() {
  if (!PAYSTACK_SECRET_KEY) {
    return NextResponse.json({ error: "Server misconfigured" }, { status: 500 });
  }
  try {
    const res = await fetch("https://api.paystack.co/bank?country=nigeria", {
      headers: { Authorization: `Bearer ${PAYSTACK_SECRET_KEY}` },
    });
    const data = await res.json();
    if (!res.ok || !data.status) {
      return NextResponse.json({ error: data.message || "Could not fetch banks" }, { status: 400 });
    }
    const banks = data.data.map((b: any) => ({ name: b.name, code: b.code }));
    return NextResponse.json({ banks });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
