import "./globals.css";
import Nav from "@/components/Nav";
import { Web3Provider } from "@/contexts/Web3Context";
import { ToastProvider } from "@/contexts/ToastContext";
import ChainGuard from "@/components/ChainGuard";
import ConnectBanner from "@/components/ConnectBanner";

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <Web3Provider>
          <ToastProvider>
            <ChainGuard>
              <Nav />
              <ConnectBanner /> 
              <main className="mx-auto max-w-5xl p-6">{children}</main>
            </ChainGuard>
          </ToastProvider>
        </Web3Provider>
      </body>
    </html>
  );
}
