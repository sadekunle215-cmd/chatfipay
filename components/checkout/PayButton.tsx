"use client";
import React, { useState, useEffect, useCallback } from "react";
import { buildSolanaPayUrl } from "@/lib/solanaPay";
import { Check, Loader2 } from "lucide-react";

interface PayButtonProps {
  paymentId: string;
  walletAddress: string;
  amount: number | null;
  label: string;
  token?: string;
  storeUsername?: string;
}

const PayButton = ({ paymentId, walletAddress, amount, label, token = "SOL", storeUsername }: PayButtonProps) => {
  const [status, setStatus] = useState<"idle" | "paying" | "polling">("idle");
  const [paid, setPaid] = useState(false);
  const [countdown, setCountdown] = useState(3);

  const pollPayment = useCallback(async () => {
    try {
      const res = await fetch(`/api/verify/${paymentId}`);
      const data = await res.json();
      if (data.status === "completed") {
        setPaid(true);
        // Redirect to store after 2 seconds
        if (storeUsername) {
          setTimeout(() => {
            window.location.href = `https://store.chatfi.pro/${storeUsername}?order=${paymentId}&paid=true`;
          }, 2000);
        }
        return true;
      }
    } catch {}
    return false;
  }, [paymentId, storeUsername]);

  useEffect(() => {
    if (status !== "polling") return;
    const interval = setInterval(async () => {
      const done = await pollPayment();
      if (done) clearInterval(interval);
    }, 4000);
    return () => clearInterval(interval);
  }, [status, pollPayment]);

  // Countdown after opening wallet
  useEffect(() => {
    if (status !== "paying") return;
    setCountdown(3);
    const t = setInterval(() => {
      setCountdown(c => {
        if (c <= 1) { clearInterval(t); setStatus("polling"); return 0; }
        return c - 1;
      });
    }, 1000);
    return () => clearInterval(t);
  }, [status]);

  if (paid) {
    return (
      <div className="flex flex-col items-center gap-4 py-4 text-center">
        <div className="w-16 h-16 rounded-full bg-[#C7F284]/10 border border-[#C7F284]/30 flex items-center justify-center">
          <Check size={32} className="text-[#C7F284]" />
        </div>
        <p className="text-[#C7F284] text-xl font-bold">Payment Received!</p>
        <p className="text-gray-400 text-sm">Redirecting you back to store...</p>
      </div>
    );
  }

  const handlePay = () => {
    // Use solana: deeplink — works with ALL Solana wallets (25+)
    const url = buildSolanaPayUrl({
      walletAddress,
      amount,
      token,
      label,
      reference: paymentId,
      message: "Payment via ChatFi Pay",
    });
    setStatus("paying");
    window.location.href = url;
  };

  if (status === "polling") {
    return (
      <div className="flex flex-col items-center gap-3 py-2">
        <div className="flex items-center gap-2 text-[#C7F284]">
          <Loader2 size={18} className="animate-spin" />
          <span className="text-sm font-medium">Confirming payment...</span>
        </div>
        <p className="text-gray-500 text-xs text-center">Checking blockchain for your transaction</p>
        <button onClick={() => setStatus("idle")} className="text-gray-600 text-xs underline">Cancel</button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3 w-full">
      <button
        onClick={handlePay}
        disabled={status === "paying"}
        className="w-full bg-[#C7F284] text-black font-bold rounded-xl py-4 text-base hover:opacity-90 transition-all disabled:opacity-50"
      >
        {status === "paying" ? `Opening wallet... (${countdown})` : `Pay${amount ? ` ${amount} ${token}` : ""}`}
      </button>
      <p className="text-gray-500 text-xs text-center">Opens any Solana wallet app on your device</p>
    </div>
  );
};

export default PayButton;
