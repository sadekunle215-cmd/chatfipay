import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/firebaseAdmin";
import { Timestamp } from "firebase-admin/firestore";
import crypto from "crypto";

// POST /api/store/[slug]/charge — public checkout endpoint, no API key needed
export async function POST(req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;

  try {
    const body = await req.json();
    const { productId, quantity, buyerName, buyerPhone, buyerAddress, buyerEmail, buyerWallet } = body;

    if (!productId) return NextResponse.json({ error: "Missing productId" }, { status: 400 });
    if (!buyerName || !buyerPhone || !buyerAddress) {
      return NextResponse.json({ error: "Name, phone, and address are required" }, { status: 400 });
    }

    const qty = Math.max(1, parseInt(quantity, 10) || 1);

    const storeSnap = await db.collection("stores").doc(slug).get();
    if (!storeSnap.exists) return NextResponse.json({ error: "Store not found" }, { status: 404 });
    const store = storeSnap.data()!;
    if (!store.live) return NextResponse.json({ error: "Store is offline" }, { status: 403 });

    const productSnap = await db.collection("stores").doc(slug).collection("products").doc(productId).get();
    if (!productSnap.exists) return NextResponse.json({ error: "Product not found" }, { status: 404 });
    const product = productSnap.data()!;
    if (!product.active) return NextResponse.json({ error: "Product unavailable" }, { status: 400 });

    if (product.stock !== null && product.stock !== undefined && qty > product.stock) {
      return NextResponse.json({ error: `Only ${product.stock} left in stock` }, { status: 400 });
    }

    const amount = product.price * qty;
    const orderId = crypto.randomBytes(8).toString("hex");
    const now = Timestamp.now();
    const expiresAt = Timestamp.fromMillis(now.toMillis() + 24 * 60 * 60000);

    const payLinkId = crypto.randomBytes(8).toString("hex");
    await db.collection("pay_links").doc(payLinkId).set({
      merchantId: slug,
      walletAddress: store.ownerWallet,
      amount,
      token: "USDC",
      label: `${product.name} x${qty}`,
      memo: `Order ${orderId} - ${store.name}`,
      status: "pending",
      storeOrder: true,
      storeSlug: slug,
      orderId,
      idempotencyKey: null,
      createdAt: now,
      expiresAt,
      paidAt: null,
      txSignature: null,
      payerWallet: buyerWallet || null,
      receivedAmount: null,
    });

    await db.collection("stores").doc(slug).collection("orders").doc(orderId).set({
      id: orderId,
      productId,
      productName: product.name,
      quantity: qty,
      amount,
      buyerName,
      buyerPhone,
      buyerAddress,
      buyerEmail: buyerEmail || null,
      buyerWallet: buyerWallet || null,
      status: "pending",
      paymentRef: payLinkId,
      chatfiPaySlug: payLinkId,
      createdAt: now,
      paidAt: null,
    });

    await db.collection("storeKeys").doc(slug).update({ lastUsed: now });

    return NextResponse.json({
      success: true,
      orderId,
      paymentLink: `https://pay.chatfi.pro/pay/${payLinkId}`,
      amount,
      quantity: qty,
      product: product.name,
      status: "pending",
      expiresAt: expiresAt.toDate().toISOString(),
    });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
