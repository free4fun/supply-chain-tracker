// web/src/app/page.tsx
"use client";
import { useWeb3 } from "@/contexts/Web3Context";

export default function Page() {
  const { account, chainId, ready, mustConnect, error, reconnect, switchAcc } = useWeb3();

  return (
    <main className="min-h-screen grid place-items-center p-6">
      <div className="space-y-3 text-center">
        <h1 className="text-2xl font-bold">Supply Chain Tracker</h1>

        {!ready ? <p>Loading…</p> : (
          <>
            {account && (
              <div className="space-y-1">
                <p>Account: {account}</p>
                <p>ChainId: {chainId}</p>
              </div>
            )}
            {mustConnect && (
              <div className="space-y-2">
                <p className="text-sm">You must connect your wallet.</p>
                <div className="flex gap-2 justify-center">
                  <button onClick={reconnect} className="px-4 py-2 rounded bg-black text-white">Connect wallet</button>
                  <button onClick={switchAcc} className="px-4 py-2 rounded border">Switch account</button>
                </div>
              </div>
            )}
            {!mustConnect && (
              <div className="flex gap-2 justify-center">
                <button onClick={switchAcc} className="px-4 py-2 rounded border">Switch account</button>
              </div>
            )}
            {error && <p className="text-sm text-red-600">{error}</p>}
          </>
        )}
      </div>
    </main>
  );
}
