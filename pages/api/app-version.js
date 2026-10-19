import { getAppBuildId } from "../../utils/getAppBuildId";

export default function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "Method not allowed" });
  }
  const appBuildId = getAppBuildId();
  if (!appBuildId) return res.status(503).json({ error: "アプリの版を確認できません。" });
  return res.status(200).json({ appBuildId });
}
