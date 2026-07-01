import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/firebaseAdmin";
import { FieldValue } from "firebase-admin/firestore";

const BACKFILL_SECRET = "chatfi_backfill_9f2a71x";

function normalizePhone(raw: string | null | undefined): string | null {
  if (!raw) return null;
  let digits = raw.replace(/\D/g, "");
  if (!digits) return null;
  if (digits.startsWith("0")) digits = "234" + digits.slice(1);
  else if (!digits.startsWith("234")) digits = "234" + digits;
  return digits;
}

function normalizeEmail(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const trimmed = raw.trim().toLowerCase();
  return trimmed || null;
}

// GET /api/admin/backfill-customers?secret=...
// One-off: for every paid order missing customerKey, derive it from
// buyerPhone/buyerEmail and upsert the matching customer doc.
// Idempotent — safe to re-run, skips orders that already have customerKey.
// DELETE THIS ROUTE after running once.
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  if (searchParams.get("secret") !== BACKFILL_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const results: any[] = [];
  const storesSnap = await db.collection("stores").get();

  for (const storeDoc of storesSnap.docs) {
    const slug = storeDoc.id;
    const ordersSnap = await storeDoc.ref.collection("orders")
      .where("status", "==", "paid")
      .get();

    for (const orderDoc of ordersSnap.docs) {
      const order = orderDoc.data();
      if (order.customerKey) continue;

      const normalizedPhone = normalizePhone(order.buyerPhone);
      const normalizedEmail = normalizeEmail(order.buyerEmail);
      const customerKey = normalizedPhone || normalizedEmail;

      if (!customerKey) {
        results.push({ slug, orderId: orderDoc.id, skipped: "no phone or email on order" });
        continue;
      }

      await orderDoc.ref.update({
        buyerPhoneNormalized: normalizedPhone,
        buyerEmailNormalized: normalizedEmail,
        customerKey,
      });

      const custRef = storeDoc.ref.collection("customers").doc(customerKey);
      const custSnap = await custRef.get();
      const paidAt = order.paidAt || order.createdAt;
      const custUpdate: any = {
        phone: order.buyerPhone || null,
        name: order.buyerName || null,
        email: order.buyerEmail || null,
        address: order.buyerAddress || order.buyerDelivery || null,
        totalSpent: FieldValue.increment(order.amount || 0),
        orderCount: FieldValue.increment(1),
        lastOrderAt: paidAt,
      };
      if (!custSnap.exists) custUpdate.firstOrderAt = paidAt;
      await custRef.set(custUpdate, { merge: true });

      results.push({ slug, orderId: orderDoc.id, customerKey, backfilled: true });
    }
  }

  return NextResponse.json({ success: true, count: results.filter(r => r.backfilled).length, results });
}
