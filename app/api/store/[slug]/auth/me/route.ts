import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/firebaseAdmin";
import { verifyBuyerToken } from "@/lib/buyerAuth";

// GET /api/store/[slug]/auth/me — Authorization: Bearer <token>
// Returns the logged-in buyer's account summary + full order history.
export async function GET(req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const authHeader = req.headers.get("authorization") || "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;
  const payload = verifyBuyerToken(token);

  if (!payload || payload.slug !== slug) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const custSnap = await db.collection("stores").doc(slug).collection("customers").doc(payload.email).get();
    const customer = custSnap.exists ? custSnap.data()! : null;

    const ordersSnap = await db.collection("stores").doc(slug).collection("orders")
      .where("customerKey", "==", payload.email)
      .orderBy("createdAt", "desc")
      .limit(100)
      .get();

    const orders = ordersSnap.docs.map(d => {
      const data = d.data();
      return {
        id: d.id,
        items: data.items || (data.productId ? [{ productId: data.productId, productName: data.productName, quantity: data.quantity || 1 }] : []),
        amount: data.amount,
        status: data.status,
        fulfillmentStatus: data.fulfillmentStatus || null,
        createdAt: data.createdAt?.toDate?.()?.toISOString() || null,
        paidAt: data.paidAt?.toDate?.()?.toISOString() || null,
      };
    });

    const response = NextResponse.json({
      success: true,
      email: payload.email,
      account: {
        name: customer?.name || null,
        phone: customer?.phone || null,
        address: customer?.address || null,
        totalSpent: customer?.totalSpent || 0,
        orderCount: customer?.orderCount || 0,
      },
      orders,
    });
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
      "Access-Control-Allow-Methods": "GET, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
    },
  });
}
