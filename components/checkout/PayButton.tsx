"use client";
import React, { useState, useEffect } from "react";
import { buildSolanaPayUrl } from "@/lib/solanaPay";

interface PayButtonProps {
  paymentId: string;
  walletAddress: string;
  amount: number | null;
  label: string;
  token?: string;
}

import { Check } from "lucide-react";

const PayButton = ({ paymentId, walletAddress, amount, label, token = "SOL" }: PayButtonProps) => {
  const [status, setStatus] = useState<"idle" | "paying">("idle");
  const [paid, setPaid] = useState(false);

  useEffect(() => {
    if (status !== "paying") return;
    const interval = setInterval(async () => {
      try {
        const res = await fetch(`/api/verify/${paymentId}`);
        const data = await res.json();
        if (data.status === "completed") {
          setPaid(true);
          clearInterval(interval);
        }
      } catch {}
    }, 5000);
    return () => clearInterval(interval);
  }, [status, paymentId]);

  if (paid) {
    return (
      <div className="flex flex-col items-center gap-4 py-4 text-center">
        <div className="w-16 h-16 rounded-full bg-[#C7F284]/10 border border-[#C7F284]/30 flex items-center justify-center">
          <Check size={32} className="text-[#C7F284]" />
        </div>
        <p className="text-[#C7F284] text-xl font-bold">Payment Received!</p>
        <p className="text-gray-400 text-sm">Your order has been confirmed.</p>
      </div>
    );
  }

  const handlePay = () => {
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
    setTimeout(() => setStatus("idle"), 3000);
  };

  return (
    <div className="flex flex-col gap-3 w-full">
      <button
        onClick={handlePay}
        disabled={status === "paying"}
        className="w-full bg-[#C7F284] text-black font-bold rounded-xl py-4 text-base hover:opacity-90 transition-all disabled:opacity-50"
      >
        {status === "paying" ? "Opening wallet..." : `Pay${amount ? ` ${amount} ${token}` : ""}`}
      </button>
      <p className="text-gray-500 text-xs text-center">Opens your Solana wallet app to complete payment</p>
    </div>
  );
};

export default PayButton;
