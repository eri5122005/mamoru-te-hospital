export default function handler(req, res) {
  return res.status(410).json({
    error: "この登録方法は廃止されています。現在の正式な登録画面を使用してください。",
  });
}
