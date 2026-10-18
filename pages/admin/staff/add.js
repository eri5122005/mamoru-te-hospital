"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/router";
import AdminLayout from "@/components/AdminLayout";
import BackButton from "@/components/BackButton";
import { staffDepartments, validateStaffRegistration } from "@/utils/adminStaffRegistration";

export default function AddStaffPage() {
  const router = useRouter();
  const [staffId, setStaffId] = useState("");
  const [name, setName] = useState("");
  const [wardId, setWardId] = useState("");
  const [workDays, setWorkDays] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const submittingRef = useRef(false);

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (submittingRef.current) return;
    const result = validateStaffRegistration({ staffId, name, wardId, workDays });
    setError("");
    if (result.error) { setError(result.error); return; }
    submittingRef.current = true;
    setIsSubmitting(true);
    try {
      const response = await fetch("/api/admin/staff-add", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(result.data),
      });
      if (!response.ok) {
        const body = await response.json().catch(() => null);
        setError(typeof body?.error === "string" ? body.error : "登録結果を確認できませんでした。再登録せず、管理者に確認してください。");
        return;
      }
      router.push("/admin/staff");
    } catch (error) {
      setError("登録結果を確認できませんでした。再登録せず、管理者に確認してください。");
    } finally {
      submittingRef.current = false;
      setIsSubmitting(false);
    }
  };

  return (
    <AdminLayout>
      <div style={{ maxWidth: "480px", margin: "0 auto" }}>
        <h1 style={{ color: "#006b5f", textAlign: "center", fontSize: "26px" }}>👤 スタッフの追加</h1>
        <form onSubmit={handleSubmit} style={{ background: "white", padding: "24px", borderRadius: "12px", border: "1px solid #cfeeee" }}>
          <label style={labelStyle}>職員番号
            <input value={staffId} onChange={(e) => setStaffId(e.target.value)} style={inputStyle} disabled={isSubmitting} />
          </label>
          <label style={labelStyle}>氏名
            <input value={name} onChange={(e) => setName(e.target.value)} style={inputStyle} disabled={isSubmitting} />
          </label>
          <label style={labelStyle}>部署
            <select value={wardId} onChange={(e) => setWardId(e.target.value)} style={inputStyle} disabled={isSubmitting}>
              <option value="">選択してください</option>
              {Object.entries(staffDepartments).map(([id, label]) => <option key={id} value={id}>{label}</option>)}
            </select>
          </label>
          <label style={labelStyle}>月の勤務日数
            <input type="number" min="1" step="1" value={workDays} onChange={(e) => setWorkDays(e.target.value)} style={inputStyle} disabled={isSubmitting} />
          </label>
          {error && <p role="alert" style={{ color: "#a32929", lineHeight: 1.6 }}>{error}</p>}
          <button type="submit" disabled={isSubmitting} style={{ width: "100%", padding: "14px", borderRadius: "10px", border: "none", background: "#006b5f", color: "white", fontSize: "16px", cursor: "pointer" }}>
            {isSubmitting ? "登録中…" : "登録する"}
          </button>
        </form>
        <BackButton to="/admin/staff" />
      </div>
    </AdminLayout>
  );
}

const labelStyle = { display: "block", color: "#006b5f", marginBottom: "16px" };
const inputStyle = { display: "block", boxSizing: "border-box", width: "100%", marginTop: "6px", padding: "12px", border: "1px solid #cfeeee", borderRadius: "8px", fontSize: "16px", background: "#f5fafa" };
