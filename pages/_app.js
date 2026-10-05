import "@/styles/globals.css";
import Head from "next/head";
import { useEffect } from "react";

export default function App({ Component, pageProps }) {

  // ★ Service Worker を登録（最重要）
  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/service-worker.js");
    }
  }, []);

  // ★ PWA更新を強制チェック（更新の安定化）
  useEffect(() => {
    if (typeof window !== "undefined" && "serviceWorker" in navigator) {
      navigator.serviceWorker.getRegistration().then((reg) => {
        if (reg) {
          reg.update(); // ← 新しいSWがあれば即チェック
        }
      });
    }
  }, []);

   // ★ 新しいバージョンが適用されたら通知する（今回追加）
  useEffect(() => {
    if (typeof window !== "undefined" && "serviceWorker" in navigator) {
      navigator.serviceWorker.addEventListener("controllerchange", () => {
        alert("新しいバージョンが利用可能です。アプリを再起動してください。");
      });
    }
  }, []);
  
  return (
    <>
      <Head>
        <link rel="manifest" href="/manifest.json" />
        <link rel="apple-touch-icon" sizes="180x180" href="/icons/icon-192.png" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="theme-color" content="#cfeeee" />
      </Head>

      <main
        style={{
          background: "#F9F9F9",
          minHeight: "100vh",
          padding: "16px",
          fontFamily: "sans-serif",
          maxWidth: "480px",
          margin: "0 auto",
        }}
      >
        <Component {...pageProps} />
      </main>
    </>
  );
}
