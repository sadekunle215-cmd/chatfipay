import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/firebase";
import { doc, getDoc, setDoc } from "firebase/firestore";

const PAYSTACK_SECRET_KEY = process.env.PAYSTACK_SECRET_KEY as string;
const PAYSTACK_BASE_URL = "https://api.paystack.co";

// GET /api/merchant/paystack-subaccount?wallet=xxx
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const wallet = searchParams.get("wallet");
  if (!wallet) return NextResponse.json({ error: "Missing wallet" }, { status: 400 });

  try {
    const snap = await getDoc(doc(db, "merchants", wallet));
    if (!snap.exists()) {
      return NextResponse.json({ connected: false });
    }

    const data = snap.data();
    return NextResponse.json({
      connected: !!data.paystackSubaccountCode,
      subaccountCode: data.paystackSubaccountCode || "",
      bankName: data.paystackBankName || "",
      accountNumber: data.paystackAccountNumberMasked || "",
      verified: data.paystackAccountVerified || false,
    });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

// POST /api/merchant/paystack-subaccount
// body: { walletAddress, businessName, bankCode, accountNumber, percentageCharge? }
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { walletAddress, businessName, bankCode, accountNumber, percentageCharge } = body;

    if (!walletAddress) return NextResponse.json({ error: "Missing walletAddress" }, { status: 400 });
    if (!businessName) return NextResponse.json({ error: "Missing businessName" }, { status: 400 });
    if (!bankCode) return NextResponse.json({ error: "Missing bankCode" }, { status: 400 });
    if (!accountNumber) return NextResponse.json({ error: "Missing accountNumber" }, { status: 400 });

    if (!PAYSTACK_SECRET_KEY) {
      console.error("Missing PAYSTACK_SECRET_KEY env var");
      return NextResponse.json({ error: "Server misconfigured" }, { status: 500 });
    }

    const resolveRes = await fetch(
      `${PAYSTACK_BASE_URL}/bank/resolve?account_number=${accountNumber}&bank_code=${bankCode}`,
      {
        headers: { Authorization: `Bearer ${PAYSTACK_SECRET_KEY}` },
      }
    );
    const resolveData = await resolveRes.json();

    if (!resolveRes.ok || !resolveData.status) {
      return NextResponse.json(
        { error: resolveData.message || "Could not verify account number" },
        { status: 400 }
      );
    }

    const resolvedAccountName = resolveData.data.account_name;

    const subaccountRes = await fetch(`${PAYSTACK_BASE_URL}/subaccount`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${PAYSTACK_SECRET_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        business_name: businessName,
        bank_code: bankCode,
        account_number: accountNumber,
        percentage_charge: percentageCharge ?? 0,
      }),
    });
    const subaccountData = await subaccountRes.json();

    if (!subaccountRes.ok || !subaccountData.status) {
      return NextResponse.json(
        { error: subaccountData.message || "Could not create subaccount" },
        { status: 400 }
      );
    }

    const subaccountCode = subaccountData.data.subaccount_code;
    const maskedAccountNumber = `****${accountNumber.slice(-4)}`;

    await setDoc(
      doc(db, "merchants", walletAddress),
      {
        walletAddress,
        paystackSubaccountCode: subaccountCode,
        paystackBankCode: bankCode,
        paystackAccountNumberMasked: maskedAccountNumber,
        paystackAccountName: resolvedAccountName,
        paystackAccountVerified: true,
        updatedAt: new Date().toISOString(),
      },
      { merge: true }
    );

    return NextResponse.json({
      success: true,
      subaccountCode,
      accountName: resolvedAccountName,
    });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
