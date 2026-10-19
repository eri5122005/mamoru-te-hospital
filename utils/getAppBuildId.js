// This literal environment access is replaced at build time by Next.js.
export function getAppBuildId() {
  const value = process.env.NEXT_PUBLIC_APP_BUILD_ID;
  return typeof value === "string" && /^[A-Za-z0-9_-]{1,128}$/.test(value)
    ? value : null;
}
