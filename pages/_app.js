import "@/styles/globals.css";
import Head from "next/head";
import { useEffect } from "react";

export default function App({ Component, pageProps }) {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;

    let refreshing = false;

    // 新しいService Workerに切り替わったら1回だけ再読み込み
    const handleControllerChange = () => {
      if (refreshing) return;

      refreshing = true;
      window.location.reload();
    };

    navigator.serviceWorker.addEventListener(
      "controllerchange",
      handleControllerChange
    );

    // Service Workerを登録し、最新版がないか確認
    navigator.serviceWorker
      .register("/service-worker.js")
      .then((registration) => {
        registration.update();
      })
      .catch((error) => {
        console.error("Service Worker registration failed:", error);
      });

    return () => {
      navigator.serviceWorker.removeEventListener(
        "controllerchange",
        handleControllerChange
      );
    };
  }, []);

  return (
    <>
      <Head>
        <link rel="manifest" href="/manifest.json" />
        <link
          rel="apple-touch-icon"
          sizes="180x180"
          href="/icons/icon-192.png"
        />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta
          name="apple-mobile-web-app-status-bar-style"
          content="default"
        />
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