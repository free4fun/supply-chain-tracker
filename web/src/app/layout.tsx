import "./globals.css";
import Nav from "@/components/Nav";
import { Web3Provider } from "@/contexts/Web3Context";
import { ToastProvider } from "@/contexts/ToastContext";
import { RoleProvider } from "@/contexts/RoleContext";
import { I18nProvider } from "@/contexts/I18nContext";
import ChainGuard from "@/components/ChainGuard";
import ConnectBanner from "@/components/ConnectBanner";
import ThemeController from "@/components/ThemeController";

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              try {
                const stored = localStorage.getItem('color-scheme');
                // Only apply dark if user explicitly chose it; default is light
                if (stored === 'dark') document.documentElement.classList.add('dark');
              } catch {}
            `,
          }}
        />
      </head>
      <body>
        <I18nProvider>
          <Web3Provider>
            <ToastProvider>
              <RoleProvider>
                <ThemeController />
                <ChainGuard>
                  <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
                    <Nav />
                    <ConnectBanner />
                    <main className="w-full">{children}</main>
                  </div>
                </ChainGuard>
              </RoleProvider>
            </ToastProvider>
          </Web3Provider>
        </I18nProvider>
      </body>
    </html>
  );
}
