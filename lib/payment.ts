import { db } from "./firebase";
import { db as adminDb } from "./firebaseAdmin";
import { doc, setDoc, getDoc, updateDoc, serverTimestamp } from "firebase/firestore";
import { nanoid } from "nanoid";

export interface PaymentRequest {
  id: string;
  walletAddress: string;
  amount: number | null;
  label: string;
  memo: string;
  status: "pending" | "completed" | "cancelled";
  createdAt: any;
  paidAt?: any;
  paidBy?: string;
  txSignature?: string;
}

export async function createPaymentRequest(
  walletAddress: string,
  amount: number | null,
  label: string,
  memo: string
): Promise<string> {
  const id = nanoid(10);
  const payment: PaymentRequest = {
    id,
    walletAddress,
    amount,
    label,
    memo,
    status: "pending",
    createdAt: serverTimestamp(),
  };
  await setDoc(doc(db, "payments", id), payment);
  return id;
}

export async function getPaymentRequest(id: string): Promise<PaymentRequest | null> {
  // Try pay_links first (store checkout) using admin SDK
  const payLinkSnap = await adminDb.collection("pay_links").doc(id).get();
  if (payLinkSnap.exists) {
    const d = payLinkSnap.data()!;
    return {
      id,
      walletAddress: d.walletAddress,
      amount: d.amount,
      label: d.label,
      memo: d.memo,
      status: d.status,
      createdAt: d.createdAt,
      paidAt: d.paidAt,
      txSignature: d.txSignature,
    } as PaymentRequest;
  }
  // Fall back to payments collection
  const snap = await adminDb.collection("payments").doc(id).get();
  if (!snap.exists) return null;
  return snap.data() as PaymentRequest;
}

export async function markPaymentComplete(
  id: string,
  paidBy: string,
  txSignature: string
): Promise<void> {
  await updateDoc(doc(db, "payments", id), {
    status: "completed",
    paidBy,
    txSignature,
    paidAt: serverTimestamp(),
  });
}
