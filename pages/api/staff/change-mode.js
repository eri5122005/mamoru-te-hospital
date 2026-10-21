export default function handler(req, res) {
  return res.status(410).json({
    error: "MODE_CHANGE_DISABLED",
    message: "方式変更機能は現在使用できません。",
  });
}
