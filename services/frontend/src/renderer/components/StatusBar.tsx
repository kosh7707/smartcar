import React, { useEffect, useRef } from "react";
import { healthCheck } from "../api/client";
import { useToast } from "../contexts/ToastContext";
import "./StatusBar.css";

export const StatusBar: React.FC = () => {
  const toast = useToast();
  const wasConnected = useRef(true);

  useEffect(() => {
    const check = async () => {
      try {
        const data = await healthCheck();
        const ok = data?.status === "ok";
        if (!ok && wasConnected.current) {
          toast.error("백엔드 연결이 끊어졌습니다.");
        }
        wasConnected.current = ok;
      } catch {
        if (wasConnected.current) {
          toast.error("백엔드 연결이 끊어졌습니다.");
        }
        wasConnected.current = false;
      }
    };

    check();
    const interval = setInterval(check, 15000);
    return () => clearInterval(interval);
  }, [toast]);

  return (
    <div className="statusbar">
      <div className="statusbar-item">
        <span>AEGIS v0.1.0</span>
      </div>
    </div>
  );
};
