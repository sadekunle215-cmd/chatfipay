import { NextRequest, NextResponse } from "next/server";
import { getPaymentRequest, markPaymentComplete } from "@/lib/payment";
import { db } from "@/lib/firebase";
import { doc, getDoc, updateDoc } from "firebase/firestore";
import { collection, query, where, getDocs } from "firebase/firestore";

async function sendPushNotification(token: string, amount: number | null, label: string) {
  await fetch("https://exp.host/--/api/v2/push/send", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      to: token,
      title: "Payment Received!",
      body: `${amount ? `${amount} SOL` : "Payment"} received${label ? ` for ${label}` : ""}`,
      sound: "default",
    }),
  });
}

async function fireWebhook(webhookUrl: string, payment: any, txSignature: string) {
  try {
    await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        event: "payment.confirmed",
        id: payment.id,
        amount: payment.amount,
        label: payment.label,
        memo: payment.memo,
        walletAddress: payment.walletAddress,
        txSignature,
        paidAt: new Date().toISOString(),
      }),
    });
  } catch (e) {
    console.error("Webhook failed:", e);
  }
}

async function getMerchantData(walletAddress: string) {
  try {
    const snap = await getDoc(doc(db, "merchants", walletAddress));
    if (snap.exists()) return snap.data();
  } catch (e) {}
  return null;
}

async function updateMerchantStats(walletAddress: string, amount: number | null) {
  try {
    const snap = await getDoc(doc(db, "merchants", walletAddress));
    if (snap.exists()) {
      const data = snap.data();
      const stats = data.stats || { total: 0, completed: 0, pending: 0, volume: 0 };
      await updateDoc(doc(db, "merchants", walletAddress), {
        stats: {
          ...stats,
          completed: (stats.completed || 0) + 1,
          volume: (stats.volume || 0) + (amount || 0),
        }
      });
    }
  } catch (e) {
    console.error("Stats update failed:", e);
  }
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;

  try {
    const payment = await getPaymentRequest(slug);
    if (!payment) {
      return NextResponse.json({ error: "Payment not found" }, { status: 404 });
    }

    if (payment.status === "completed") {
      return NextResponse.json({ status: "completed", txSignature: payment.txSignature });
    }

    const rpcUrl = process.env.HELIUS_RPC_URL;
    if (!rpcUrl) {
      return NextResponse.json({ error: "RPC not configured" }, { status: 500 });
    }

    const res = await fetch(rpcUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "getSignaturesForAddress",
        params: [payment.walletAddress, { limit: 10 }],
      }),
    });

    const data = await res.json();
    const signatures = data.result || [];

    for (const sig of signatures) {
      const txRes = await fetch(rpcUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: 1,
          method: "getTransaction",
          params: [sig.signature, { encoding: "jsonParsed", maxSupportedTransactionVersion: 0 }],
        }),
      });

      const txData = await txRes.json();
      const tx = txData.result;
      if (!tx) continue;

      const accounts = tx.transaction?.message?.accountKeys || [];
      const hasReference = accounts.some((a: any) => a.pubkey === slug);

      if (hasReference) {
        const paidBy = accounts[0]?.pubkey || "unknown";
        await markPaymentComplete(slug, paidBy, sig.signature);

        const merchant = await getMerchantData(payment.walletAddress);

        // Push notification
        if (merchant?.expoPushToken) {
          await sendPushNotification(merchant.expoPushToken, payment.amount, payment.label);
        } else {
          try {
            const userSnap = await getDoc(doc(db, "chatfi_users", payment.walletAddress));
            const userData = userSnap.data();
            if (userData?.expoPushToken) {
              await sendPushNotification(userData.expoPushToken, payment.amount, payment.label);
            }
          } catch (e) {}
        }

        // Fire webhook
        if (merchant?.webhookUrl) {
          await fireWebhook(merchant.webhookUrl, payment, sig.signature);
        }

        // Update merchant stats
        await updateMerchantStats(payment.walletAddress, payment.amount);

        return NextResponse.json({ status: "completed", txSignature: sig.signature });
      }
    }

    return NextResponse.json({ status: "pending" });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Verification failed" }, { status: 500 });
  }
}
