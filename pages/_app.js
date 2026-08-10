import "@/styles/globals.css";

export default function App({ Component, pageProps }) {
  return (
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
  );
}
