import { db } from "./firebaseAdmin";

export interface PaymentRequest {
  id: string;
  walletAddress: string;
  amount: number | null;
  token: string;
  label: string;
  memo: string;
  status: "pending" | "completed" | "cancelled";
  createdAt: any;
  paidAt?: any;
  paidBy?: string;
  txSignature?: string;
  storeSlug?: string;
}

export async function getPaymentRequest(id: string): Promise<PaymentRequest | null> {
  const payLinkSnap = await db.collection("pay_links").doc(id).get();
  if (payLinkSnap.exists) {
    const d = payLinkSnap.data()!;
    return {
      id,
      walletAddress: d.walletAddress,
      amount: d.amount,
      token: d.token || "SOL",
      label: d.label,
      memo: d.memo,
      status: d.status,
      createdAt: d.createdAt,
      paidAt: d.paidAt,
      txSignature: d.txSignature,
      ngnAmount: d.ngnAmount || null,
      storeSlug: d.storeSlug || null,
    } as PaymentRequest;
  }
  const snap = await db.collection("payments").doc(id).get();
  if (!snap.exists) return null;
  const d = snap.data()!;
  return { ...d, token: d.token || "SOL" } as PaymentRequest;
}

export async function markPaymentComplete(
  id: string, paidBy: string, txSignature: string
): Promise<void> {
  await db.collection("payments").doc(id).update({
    status: "completed",
    paidBy,
    txSignature,
    paidAt: new Date().toISOString(),
  });
}
