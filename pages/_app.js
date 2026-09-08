import "@/styles/globals.css";
import Head from "next/head";

export default function App({ Component, pageProps }) {
  return (
    <>
      <Head>
        {/* PWA manifest */}
        <link rel="manifest" href="/manifest.json" />

        {/* ★ iOS Safari 用アイコン（これがないと緑背景＋Mになる） */}
        <link rel="apple-touch-icon" sizes="180x180" href="/icons/icon-192.png" />

        {/* iOS PWA設定 */}
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
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
