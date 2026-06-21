"use client";
import React, { useState } from "react";

const WALLETS = [
  {
    name: "Phantom",
    scheme: "phantom",
    logo: "https://187760183-files.gitbook.io/~/files/v0/b/gitbook-x-prod.appspot.com/o/spaces%2F-MVOiF6Zqit57erLfhPC%2Fuploads%2FKNqXMN3B5HfHNzVFWbDi%2FPhantom_SVG_Icon.svg?alt=media",
    deeplink: (url: string) => `phantom://ul/v1/browse/${encodeURIComponent(url)}?ref=${encodeURIComponent("https://chatfipay-z9xh.vercel.app")}`,
  },
  {
    name: "Solflare",
    scheme: "solflare",
    logo: "https://solflare.com/assets/logo.svg",
    deeplink: (url: string) => url,
  },
  {
    name: "Backpack",
    scheme: "backpack",
    logo: "https://backpack.app/images/backpack.png",
    deeplink: (url: string) => `backpack://v1/browse/${encodeURIComponent(url)}`,
  },
  {
    name: "Glow",
    scheme: "glow",
    logo: "https://glow.app/images/glow-logo.png",
    deeplink: (url: string) => url,
  },
  {
    name: "Exodus",
    scheme: "exodus",
    logo: "https://www.exodus.com/img/logos/exodus-logo.svg",
    deeplink: (url: string) => url,
  },
  {
    name: "Trust Wallet",
    scheme: "trust",
    logo: "https://trustwallet.com/assets/images/media/assets/TWT.png",
    deeplink: (url: string) => `trust://wc?uri=${encodeURIComponent(url)}`,
  },
  {
    name: "Coin98",
    scheme: "coin98",
    logo: "https://coin98.com/images/coin98-logo.png",
    deeplink: (url: string) => url,
  },
  {
    name: "OKX Wallet",
    scheme: "okx",
    logo: "https://static.okx.com/cdn/assets/imgs/247/58E63FEA47A2B7D7.png",
    deeplink: (url: string) => `okex://main/wc?uri=${encodeURIComponent(url)}`,
  },
  {
    name: "Brave Wallet",
    scheme: "brave",
    logo: "https://brave.com/static-assets/images/brave-logo-sans-text.svg",
    deeplink: (url: string) => url,
  },
  {
    name: "ChatFi Wallet",
    scheme: "chatfi",
    logo: "https://chatfi.pro/logo.png",
    deeplink: (url: string) => url,
  },
];

interface PayButtonProps {
  paymentId: string;
  walletAddress: string;
  amount: number | null;
  label: string;
}

const PayButton = ({ paymentId, walletAddress, amount, label }: PayButtonProps) => {
  const [status, setStatus] = useState<"idle" | "picking" | "paying">("idle");
  const [imgErrors, setImgErrors] = useState<Record<string, boolean>>({});

  const buildSolanaUrl = () => {
    const base = `solana:${walletAddress}`;
    const params = new URLSearchParams();
    if (amount) params.set("amount", String(amount));
    if (label) params.set("label", label);
    params.set("reference", paymentId);
    params.set("message", "Payment via ChatFi Pay");
    return `${base}?${params.toString()}`;
  };

  const handleWalletPick = (wallet: typeof WALLETS[0]) => {
    const solanaUrl = buildSolanaUrl();
    const deeplink = wallet.deeplink(solanaUrl);
    setStatus("paying");
    window.location.href = deeplink;
    setTimeout(() => setStatus("idle"), 3000);
  };

  if (status === "picking") {
    return (
      <div className="flex flex-col gap-3 w-full">
        <p className="text-gray-400 text-sm text-center font-semibold">Choose your wallet</p>
        <div className="grid grid-cols-2 gap-2">
          {WALLETS.map((wallet) => (
            <button
              key={wallet.scheme}
              onClick={() => handleWalletPick(wallet)}
              className="flex items-center gap-3 bg-[#1A1A1A] border border-[#2A2A2A] rounded-xl px-3 py-3 text-sm text-white hover:border-[#AAFF00] transition-all text-left"
            >
              {!imgErrors[wallet.scheme] ? (
                <img
                  src={wallet.logo}
                  alt={wallet.name}
                  width={28}
                  height={28}
                  className="rounded-lg object-contain"
                  onError={() => setImgErrors(prev => ({ ...prev, [wallet.scheme]: true }))}
                />
              ) : (
                <div className="w-7 h-7 rounded-lg bg-[#2A2A2A] flex items-center justify-center text-xs font-bold text-[#AAFF00]">
                  {wallet.name[0]}
                </div>
              )}
              <span className="font-medium text-xs">{wallet.name}</span>
            </button>
          ))}
        </div>
        <button
          onClick={() => setStatus("idle")}
          className="text-gray-500 text-xs text-center mt-1 hover:text-gray-300"
        >
          Cancel
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3 w-full">
      <button
        onClick={() => setStatus("picking")}
        disabled={status === "paying"}
        className="w-full bg-[#AAFF00] text-black font-bold rounded-xl py-4 text-base hover:bg-[#99ee00] transition-all disabled:opacity-50"
      >
        {status === "paying" ? "Opening wallet..." : `Pay${amount ? ` ${amount} SOL` : ""}`}
      </button>
      <p className="text-gray-500 text-xs text-center">
        Opens your Solana wallet to confirm payment
      </p>
    </div>
  );
};

export default PayButton;
