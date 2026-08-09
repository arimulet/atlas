import { useState, useRef, useEffect } from "react";

interface SokkerSyncModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSync: (login: string, pass: string) => Promise<void>;
  isLoading: boolean;
}

export function SokkerSyncModal({ isOpen, onClose, onSync, isLoading }: SokkerSyncModalProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [login, setLogin] = useState("");
  const [password, setPassword] = useState("");

  useEffect(() => {
    if (isOpen) {
      dialogRef.current?.showModal();
    } else {
      dialogRef.current?.close();
    }
  }, [isOpen]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!login || !password) return;
    void onSync(login, password);
  };

  return (
    <dialog
      ref={dialogRef}
      onCancel={onClose}
      style={{
        padding: "24px",
        borderRadius: "8px",
        border: "1px solid var(--border-color, #ccc)",
        background: "var(--surface-color, #fff)",
        color: "var(--text-color, #333)",
        boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
        maxWidth: "400px",
        width: "100%"
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
        <h2 style={{ margin: 0, fontSize: "1.25rem" }}>Sincronizar con Sokker</h2>
        <button
          type="button"
          onClick={onClose}
          style={{ background: "transparent", border: "none", fontSize: "1.5rem", cursor: "pointer", color: "inherit" }}
          disabled={isLoading}
        >
          &times;
        </button>
      </div>

      <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
          <label htmlFor="sokker-login" style={{ fontWeight: 600 }}>Usuario</label>
          <input
            id="sokker-login"
            type="text"
            value={login}
            onChange={(e) => setLogin(e.target.value)}
            disabled={isLoading}
            required
            style={{
              padding: "8px 12px",
              borderRadius: "4px",
              border: "1px solid var(--border-color, #ccc)",
              background: "var(--background-color, #fff)",
              color: "inherit"
            }}
          />
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
          <label htmlFor="sokker-pass" style={{ fontWeight: 600 }}>Contraseña</label>
          <input
            id="sokker-pass"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            disabled={isLoading}
            required
            style={{
              padding: "8px 12px",
              borderRadius: "4px",
              border: "1px solid var(--border-color, #ccc)",
              background: "var(--background-color, #fff)",
              color: "inherit"
            }}
          />
        </div>

        <div style={{ display: "flex", justifyContent: "flex-end", gap: "12px", marginTop: "8px" }}>
          <button
            type="button"
            onClick={onClose}
            disabled={isLoading}
            style={{
              padding: "8px 16px",
              borderRadius: "4px",
              border: "1px solid var(--border-color, #ccc)",
              background: "transparent",
              cursor: "pointer",
              color: "inherit"
            }}
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={isLoading || !login || !password}
            style={{
              padding: "8px 16px",
              borderRadius: "4px",
              border: "none",
              background: "var(--accent-color, #007bff)",
              color: "#fff",
              cursor: "pointer",
              fontWeight: 600
            }}
          >
            {isLoading ? "Sincronizando..." : "Sincronizar"}
          </button>
        </div>
      </form>
    </dialog>
  );
}
