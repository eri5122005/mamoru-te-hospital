import "@/styles/globals.css";
import Head from "next/head";

export default function App({ Component, pageProps }) {
  return (
    <>
      <Head>
        {/* ★ PWA manifest */}
        <link rel="manifest" href="/manifest.json" />

        {/* ★ iOS Safari 用アイコン */}
        <link rel="apple-touch-icon" sizes="180x180" href="/icons/icon-192.png" />

        {/* ★ PWA設定（iOS + Android 両対応） */}
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />

        {/* ★ iOS ステータスバー */}
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />

        {/* ★ Android のテーマカラー */}
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
