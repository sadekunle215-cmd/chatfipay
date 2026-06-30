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
        params: [payment.walletAddress, { limit: 20 }],
      }),
    });

    const data = await res.json();
    const signatures = data.result || [];

    // Only check transactions after payment was created
    const createdAtMs = payment.createdAt?.toMillis
      ? payment.createdAt.toMillis()
      : typeof payment.createdAt === "string"
      ? new Date(payment.createdAt).getTime()
      : Date.now() - 86400000;

    const USDC_MINT = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";
    const USDT_MINT = "Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB";
    const expectedMint = payment.token === "USDT" ? USDT_MINT : USDC_MINT;
    const expectedAmount = payment.amount ? Math.round(payment.amount * 1_000_000) : null;

    for (const sig of signatures) {
      // Skip txs before payment was created
      if (sig.blockTime && sig.blockTime * 1000 < createdAtMs) continue;

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
      const instructions = tx.transaction?.message?.instructions || [];
      const innerInstructions = tx.meta?.innerInstructions || [];

      // Check for reference key match (Solana Pay standard)
      const hasReference = accounts.some((a: any) => a.pubkey === slug);

      // Check for USDC/USDT transfer to merchant wallet
      let hasTokenTransfer = false;
      const allInstructions = [
        ...instructions,
        ...innerInstructions.flatMap((ii: any) => ii.instructions || []),
      ];
      for (const ix of allInstructions) {
        const parsed = ix.parsed;
        if (!parsed) continue;
        const type = parsed.type;
        const info = parsed.info || {};
        if (
          (type === "transfer" || type === "transferChecked") &&
          info.mint === expectedMint &&
          info.destination &&
          accounts.some((a: any) => a.pubkey === payment.walletAddress) &&
          (!expectedAmount || Math.abs((info.tokenAmount?.amount || info.amount || 0) - expectedAmount) < 10000)
        ) {
          hasTokenTransfer = true;
          break;
        }
      }

      // Also check SOL transfer if token is SOL
      let hasSolTransfer = false;
      if (payment.token === "SOL" && expectedAmount) {
        const postBalances = tx.meta?.postBalances || [];
        const preBalances = tx.meta?.preBalances || [];
        const merchantIdx = accounts.findIndex((a: any) => a.pubkey === payment.walletAddress);
        if (merchantIdx >= 0) {
          const received = (postBalances[merchantIdx] || 0) - (preBalances[merchantIdx] || 0);
          if (received > 0) hasSolTransfer = true;
        }
      }

      if (hasReference || hasTokenTransfer || hasSolTransfer) {
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
