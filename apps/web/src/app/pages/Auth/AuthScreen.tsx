import { useState, type FormEvent } from "react";
import { useAuth } from "../../context/AuthContext";
import { isFirebaseConfigured } from "../../services/firebase";
import "./styles.scss";

type AuthMode = "login" | "signup" | "forgot";

export function AuthScreen() {
  const { login, signUp, resetPassword } = useAuth();

  const [mode, setMode] = useState<AuthMode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const clearMessages = () => {
    setErrorMessage(null);
    setSuccessMessage(null);
  };

  const handleTabSwitch = (newMode: AuthMode) => {
    setMode(newMode);
    clearMessages();
    setPassword("");
    setConfirmPassword("");
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    clearMessages();

    if (!email.trim()) {
      setErrorMessage("Por favor ingrese su correo electrónico.");
      return;
    }

    if (mode === "forgot") {
      setIsSubmitting(true);
      try {
        await resetPassword(email.trim());
        setSuccessMessage("Se ha enviado un correo con instrucciones para restablecer su contraseña.");
      } catch (err: any) {
        setErrorMessage(err.message || "No se pudo enviar el correo de recuperación.");
      } finally {
        setIsSubmitting(false);
      }
      return;
    }

    if (!password) {
      setErrorMessage("Por favor ingrese su contraseña.");
      return;
    }

    if (mode === "signup") {
      if (password.length < 6) {
        setErrorMessage("La contraseña debe tener al menos 6 caracteres.");
        return;
      }
      if (password !== confirmPassword) {
        setErrorMessage("Las contraseñas no coinciden.");
        return;
      }
    }

    setIsSubmitting(true);
    try {
      if (mode === "login") {
        await login(email.trim(), password);
      } else {
        await signUp(email.trim(), password);
      }
    } catch (err: any) {
      setErrorMessage(err.message || "Ocurrió un error al procesar su solicitud.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="atlas-auth-container">
      <div className="atlas-auth-card">
        <div className="atlas-auth-card__header">
          <div className="atlas-brand" aria-label="ATLAS">
            <span className="atlas-brand__mark" aria-hidden="true">
              A
            </span>
            <span className="atlas-brand__name">ATLAS</span>
          </div>
          <p className="atlas-auth-card__subtitle">
            {mode === "login"
              ? "Inicia sesión para acceder a tu plataforma"
              : mode === "signup"
              ? "Crea una cuenta para comenzar"
              : "Restablecer contraseña"}
          </p>
        </div>

        {!isFirebaseConfigured && (
          <div className="atlas-auth-alert atlas-auth-alert--warning">
            <strong>⚠️ Configuración de Firebase requerida:</strong>
            <span>
              Configura tus credenciales en el archivo <code>.env</code> usando la plantilla <code>.env.example</code>.
            </span>
          </div>
        )}

        {mode !== "forgot" && (
          <div className="atlas-auth-tabs" role="tablist">
            <button
              type="button"
              role="tab"
              aria-selected={mode === "login"}
              className={`atlas-auth-tab ${mode === "login" ? "atlas-auth-tab--active" : ""}`}
              onClick={() => handleTabSwitch("login")}
            >
              Iniciar Sesión
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={mode === "signup"}
              className={`atlas-auth-tab ${mode === "signup" ? "atlas-auth-tab--active" : ""}`}
              onClick={() => handleTabSwitch("signup")}
            >
              Crear Cuenta
            </button>
          </div>
        )}

        {errorMessage && (
          <div className="atlas-auth-alert atlas-auth-alert--error" role="alert">
            {errorMessage}
          </div>
        )}

        {successMessage && (
          <div className="atlas-auth-alert atlas-auth-alert--success" role="status">
            {successMessage}
          </div>
        )}

        <form onSubmit={handleSubmit} className="atlas-auth-form" noValidate>
          <div className="atlas-auth-field">
            <label htmlFor="auth-email">Correo Electrónico</label>
            <input
              id="auth-email"
              type="email"
              placeholder="usuario@ejemplo.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={isSubmitting}
              required
              autoComplete="email"
            />
          </div>

          {mode !== "forgot" && (
            <div className="atlas-auth-field">
              <div className="atlas-auth-field__label-row">
                <label htmlFor="auth-password">Contraseña</label>
                {mode === "login" && (
                  <button
                    type="button"
                    className="atlas-auth-link"
                    onClick={() => handleTabSwitch("forgot")}
                  >
                    ¿Olvidaste tu contraseña?
                  </button>
                )}
              </div>
              <div className="atlas-auth-input-wrapper">
                <input
                  id="auth-password"
                  type={showPassword ? "text" : "password"}
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={isSubmitting}
                  required
                  autoComplete={mode === "login" ? "current-password" : "new-password"}
                />
                <button
                  type="button"
                  className="atlas-auth-toggle-pwd"
                  onClick={() => setShowPassword(!showPassword)}
                  tabIndex={-1}
                  aria-label={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
                >
                  {showPassword ? "🙈" : "👁️"}
                </button>
              </div>
            </div>
          )}

          {mode === "signup" && (
            <div className="atlas-auth-field">
              <label htmlFor="auth-confirm-password">Confirmar Contraseña</label>
              <input
                id="auth-confirm-password"
                type={showPassword ? "text" : "password"}
                placeholder="••••••••"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                disabled={isSubmitting}
                required
                autoComplete="new-password"
              />
            </div>
          )}

          <button
            type="submit"
            className="atlas-auth-submit-btn"
            disabled={isSubmitting}
          >
            {isSubmitting ? (
              <span className="atlas-auth-spinner" aria-hidden="true" />
            ) : mode === "login" ? (
              "Ingresar"
            ) : mode === "signup" ? (
              "Registrarse"
            ) : (
              "Enviar Correo de Recuperación"
            )}
          </button>
        </form>

        {mode === "forgot" && (
          <div className="atlas-auth-card__footer">
            <button
              type="button"
              className="atlas-auth-back-btn"
              onClick={() => handleTabSwitch("login")}
            >
              ← Volver a Iniciar Sesión
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
