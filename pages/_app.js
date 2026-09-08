import "@/styles/globals.css";
import Head from "next/head";

export default function App({ Component, pageProps }) {
  return (
    <>
      <Head>
        {/* ★ PWA manifest を読み込む（これがないとアイコンが出ない） */}
        <link rel="manifest" href="/manifest.json" />

        {/* ★ iOS Safari 用のアイコン指定（これがないとiPhoneは反映されない） */}
        <link rel="apple-touch-icon" href="/icons/icon-192.png" />

        {/* ★ iOS のステータスバー色 */}
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
