import { initializeApp, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

// ★ ESM で __dirname を使えるようにする
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ★ serviceAccountKey.json を絶対に正しく参照する
const serviceAccountPath = path.join(__dirname, "serviceAccountKey.json");

// ★ Firebase Admin 初期化
initializeApp({
  credential: cert(serviceAccountPath)
});

// ★ Firestore インスタンス
const db = getFirestore();

// ★ staff.json を読み込む
const staffData = JSON.parse(
  fs.readFileSync(path.join(__dirname, "staff.json"), "utf8")
);

// ★ Firestore に登録する処理
async function importStaff() {
  const batch = db.batch();

  Object.entries(staffData).forEach(([id, data]) => {
    const docRef = db.collection("staff").doc(id);
    batch.set(docRef, {
      ...data,
      createdAt: new Date()
    });
  });

  await batch.commit();
  console.log("部署管理者の登録が完了しました！");
}

importStaff();
