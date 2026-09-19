import { useState, type FormEvent } from "react";
import { AlertTriangle, ArrowLeft, Eye, EyeOff } from "lucide-react";
import { BrandLogo } from "@/components/BrandLogo";
import { useAuth } from "@/context/AuthContext";
import { isFirebaseConfigured } from "@/services/firebase";
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
      setErrorMessage("Please enter your email address.");
      return;
    }

    if (mode === "forgot") {
      setIsSubmitting(true);
      try {
        await resetPassword(email.trim());
        setSuccessMessage("An email with instructions to reset your password has been sent.");
      } catch (err) {
        const message = err instanceof Error ? err.message : "Could not send recovery email.";
        setErrorMessage(message);
      } finally {
        setIsSubmitting(false);
      }
      return;
    }

    if (!password) {
      setErrorMessage("Please enter your password.");
      return;
    }

    if (mode === "signup") {
      if (password.length < 6) {
        setErrorMessage("Password must be at least 6 characters long.");
        return;
      }
      if (password !== confirmPassword) {
        setErrorMessage("Passwords do not match.");
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
    } catch (err) {
      const message = err instanceof Error ? err.message : "An error occurred while processing your request.";
      setErrorMessage(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="atlas-auth-container">
      <div className="atlas-auth-card">
        <div className="atlas-auth-card__header">
          <BrandLogo variant="auth" />
          <p className="atlas-auth-card__subtitle">
            {mode === "login"
              ? "Sign in to access your platform"
              : mode === "signup"
              ? "Create an account to get started"
              : "Reset password"}
          </p>
        </div>

        {!isFirebaseConfigured && (
          <div className="atlas-auth-alert atlas-auth-alert--warning">
            <strong>
              <AlertTriangle size={15} className="inline-block align-middle" /> Firebase configuration required:
            </strong>
            <span>
              Configure your credentials in the <code>.env</code> file using the <code>.env.example</code> template.
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
              Sign In
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={mode === "signup"}
              className={`atlas-auth-tab ${mode === "signup" ? "atlas-auth-tab--active" : ""}`}
              onClick={() => handleTabSwitch("signup")}
            >
              Create Account
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
            <label htmlFor="auth-email">Email Address</label>
            <input
              id="auth-email"
              type="email"
              placeholder="user@example.com"
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
                <label htmlFor="auth-password">Password</label>
                {mode === "login" && (
                  <button
                    type="button"
                    className="atlas-auth-link"
                    onClick={() => handleTabSwitch("forgot")}
                  >
                    Forgot your password?
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
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>
          )}

          {mode === "signup" && (
            <div className="atlas-auth-field">
              <label htmlFor="auth-confirm-password">Confirm Password</label>
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
              "Sign In"
            ) : mode === "signup" ? (
              "Sign Up"
            ) : (
              "Send Recovery Email"
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
              <ArrowLeft size={14} /> Back to Sign In
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
