"use client";
import { createContext, useContext, useState } from "react";

const ToastContext = createContext();

export function ToastProvider({ children }) {
  const [messages, setMessages] = useState([]);

  const showToast = (msg) => {
    const id = Date.now();
    setMessages((prev) => [...prev, { id, msg }]);

    setTimeout(() => {
      setMessages((prev) => prev.filter((m) => m.id !== id));
    }, 3000);
  };

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}

      {/* UI */}
      <div className="fixed top-4 right-4 z-[9999] space-y-2">
        {messages.map((m) => (
          <div
            key={m.id}
            className="bg-sky-600 text-white px-4 py-2 rounded shadow text-sm"
          >
            {m.msg}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  return useContext(ToastContext);
}
