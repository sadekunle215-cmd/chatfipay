"use client";
import React, { useState } from "react";

interface PayButtonProps {
  paymentId: string;
  walletAddress: string;
  amount: number | null;
  label: string;
}

const PayButton = ({ paymentId, walletAddress, amount, label }: PayButtonProps) => {
  const [status, setStatus] = useState<"idle" | "paying">("idle");

  const handlePay = () => {
    setStatus("paying");
    const base = `solana:${walletAddress}`;
    const params = new URLSearchParams();
    if (amount) params.set("amount", String(amount));
    if (label) params.set("label", label);
    params.set("reference", paymentId);
    params.set("message", `Payment via ChatFi Pay`);
    const url = `${base}?${params.toString()}`;
    window.location.href = url;
    setTimeout(() => setStatus("idle"), 3000);
  };

  return (
    <div className="flex flex-col gap-3 w-full">
      <button
        onClick={handlePay}
        disabled={status === "paying"}
        className="w-full bg-[#AAFF00] text-black font-bold rounded-xl py-4 text-base hover:bg-[#99ee00] transition-all disabled:opacity-50"
      >
        {status === "paying" ? "Opening wallet..." : `Pay${amount ? ` ${amount} SOL` : ""}`}
      </button>
      <p className="text-gray-500 text-xs text-center">
        Opens your Solana wallet app to confirm payment
      </p>
    </div>
  );
};

export default PayButton;
