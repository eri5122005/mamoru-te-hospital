import "@/styles/globals.css";
import Head from "next/head";
import { useEffect } from "react";

export default function App({ Component, pageProps }) {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;

    let refreshing = false;
    let registration = null;

    // 新しいService Workerに切り替わったら1回だけ再読み込み
    const handleControllerChange = () => {
      if (refreshing) return;

      refreshing = true;
      window.location.reload();
    };

    // Service Workerの最新版を確認
    const checkForUpdate = () => {
      if (!registration) return;

      registration.update().catch((error) => {
        console.error("Service Worker update check failed:", error);
      });
    };

    // アプリが再び前面に戻ったときに最新版を確認
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        checkForUpdate();
      }
    };

    navigator.serviceWorker.addEventListener(
      "controllerchange",
      handleControllerChange
    );

    document.addEventListener(
      "visibilitychange",
      handleVisibilityChange
    );

    // Service Workerを登録
    navigator.serviceWorker
      .register("/service-worker.js")
      .then((reg) => {
        registration = reg;

        // アプリ起動時に最新版を確認
        checkForUpdate();
      })
      .catch((error) => {
        console.error("Service Worker registration failed:", error);
      });

    // 開きっぱなしの場合も30分ごとに最新版を確認
    const updateInterval = setInterval(() => {
      checkForUpdate();
    }, 30 * 60 * 1000);

    return () => {
      clearInterval(updateInterval);

      navigator.serviceWorker.removeEventListener(
        "controllerchange",
        handleControllerChange
      );

      document.removeEventListener(
        "visibilitychange",
        handleVisibilityChange
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