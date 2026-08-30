"use client";

import { useEffect, useState } from "react";
import { collection, getDocs } from "firebase/firestore";
import { db } from "@/firebaseConfig"; // ← あなたのパスに合わせた

import BackButton from "@/components/BackButton";

export default function WardList() {
  const [wards, setWards] = useState([]);

  useEffect(() => {
    const fetchWards = async () => {
      const querySnapshot = await getDocs(collection(db, "wards"));
      const wardList = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
      }));

      // order順に並べる（stringで保存されていてもOK）
      wardList.sort((a, b) => Number(a.order) - Number(b.order));

      setWards(wardList);
    };

    fetchWards();
  }, []);

  const innerRow = {
    display: "flex",
    alignItems: "center",
    gap: "14px",
    width: "100%",
    paddingLeft: "50px",
  };

  const mintCardStyle = {
    width: "100%",
    height: "140px",
    background: "#DFF7F2",
    borderRadius: "12px",
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    color: "#2AAE9E",
    border: "1px solid #E0E0E0",
    padding: "20px",
    cursor: "pointer",
  };

  const WardCard = ({ name }) => (
    <div style={mintCardStyle}>
      <div style={innerRow}>
        <div style={{ fontSize: "32px" }}>🏥</div>
        <div style={{ textAlign: "left", lineHeight: "1.4" }}>
          <div style={{ fontSize: "20px", fontWeight: "bold" }}>{name}</div>
        </div>
      </div>
    </div>
  );

  return (
    <div style={{ background: "#F9F9F9", minHeight: "100vh", padding: "20px" }}>
      <BackButton to="/admin" />

      <h1 style={{ fontSize: "28px", marginBottom: "20px", color: "#006b5f" }}>
        病棟一覧
      </h1>

      <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
        {wards.map((ward) => (
          <WardCard key={ward.id} name={ward.name} />
        ))}
      </div>
    </div>
  );
}

