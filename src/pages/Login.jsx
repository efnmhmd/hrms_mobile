import { useEffect, useState } from 'react';
import { api } from '../utils/api';
import { setToken, setUser, getUserGroup } from '../utils/auth';
import { getErrorMessage } from '../utils/errorHandler';

const styles = `
  .ts-login {
    font-family: 'DM Sans', sans-serif;
    -webkit-text-size-adjust: 100%;
    display: flex;
    flex-direction: column;
    min-height: 100%;
    background: #f7f8f6;
  }

  @keyframes ts-fadeUp {
    from { opacity: 0; transform: translateY(16px); }
    to   { opacity: 1; transform: translateY(0); }
  }
  @keyframes ts-slideDown {
    from { opacity: 0; transform: translateY(-12px); }
    to   { opacity: 1; transform: translateY(0); }
  }
  @keyframes ts-shake {
    0%, 100% { transform: translateX(0); }
    20% { transform: translateX(-5px); }
    40% { transform: translateX(5px); }
    60% { transform: translateX(-3px); }
    80% { transform: translateX(3px); }
  }
  @keyframes ts-spin { to { transform: rotate(360deg); } }
  @keyframes ts-pulse {
    0%, 100% { opacity: 0.4; transform: scale(1); }
    50%      { opacity: 0.8; transform: scale(1.08); }
  }

  .ts-anim-up    { animation: ts-fadeUp 0.55s cubic-bezier(0.22,1,0.36,1) both; }
  .ts-anim-down  { animation: ts-slideDown 0.5s cubic-bezier(0.22,1,0.36,1) both; }
  .ts-anim-shake { animation: ts-shake 0.45s ease; }
  .ts-delay-100 { animation-delay: 0.10s; }
  .ts-delay-200 { animation-delay: 0.20s; }
  .ts-delay-300 { animation-delay: 0.30s; }
  .ts-delay-400 { animation-delay: 0.40s; }
  .ts-delay-500 { animation-delay: 0.50s; }

  /* ── Header strip (mobile-first) ── */
  .ts-header {
    background: #2f3e46;
    position: relative;
    overflow: hidden;
    padding: calc(1.25rem + env(safe-area-inset-top)) 1.25rem 1.6rem;
  }
  .ts-header::before {
    content: ''; position: absolute; inset: 0;
    background:
      radial-gradient(ellipse at 10% 50%, rgba(82,121,111,0.4) 0%, transparent 60%),
      radial-gradient(ellipse at 90% 10%, rgba(53,79,82,0.5) 0%, transparent 50%);
    pointer-events: none;
  }
  .ts-header-grid {
    position: absolute; inset: 0;
    background-image:
      linear-gradient(rgba(202,210,197,0.04) 1px, transparent 1px),
      linear-gradient(90deg, rgba(202,210,197,0.04) 1px, transparent 1px);
    background-size: 32px 32px; pointer-events: none;
  }
  .ts-header-inner {
    position: relative; z-index: 1;
    display: flex; align-items: center; gap: 1rem;
  }
  .ts-logo-wrap {
    width: 52px; height: 52px; border-radius: 14px;
    background: rgba(202,210,197,0.10);
    border: 1px solid rgba(202,210,197,0.18);
    display: flex; align-items: center; justify-content: center;
    backdrop-filter: blur(8px); flex-shrink: 0;
    overflow: hidden;
  }
  .ts-logo-wrap img { width: 100%; height: 100%; object-fit: contain; }
  .ts-brand-eyebrow {
    font-size: 0.6rem; font-weight: 500; letter-spacing: 0.18em;
    text-transform: uppercase; color: #84a98c; margin-bottom: 0.15rem;
  }
  .ts-brand-title {
    font-family: 'Cormorant Garamond', serif; font-weight: 300;
    font-size: 1.6rem; line-height: 1.1; color: #cad2c5;
    letter-spacing: -0.01em; margin: 0;
  }

  /* ── Form area ── */
  .ts-form-area {
    flex: 1;
    background: #f7f8f6;
    position: relative;
    padding: 1.75rem 1.25rem;
    padding-bottom: max(1.75rem, calc(1rem + env(safe-area-inset-bottom)));
  }
  .ts-form-area::before {
    content: ''; position: absolute; inset: 0;
    background: radial-gradient(ellipse at 70% 0%, rgba(132,169,140,0.10) 0%, transparent 55%);
    pointer-events: none;
  }
  .ts-form-card { position: relative; z-index: 1; max-width: 480px; margin: 0 auto; }

  .ts-form-heading {
    font-family: 'Cormorant Garamond', serif;
    font-size: 1.6rem; font-weight: 400; color: #2f3e46;
    letter-spacing: -0.02em; line-height: 1.2; margin: 0;
  }
  .ts-form-sub {
    font-size: 0.8rem; color: #7a8e84; font-weight: 300;
    margin: 0.25rem 0 0;
  }

  /* ── Inputs ── */
  .ts-field-label {
    display: block; font-size: 0.7rem; font-weight: 600;
    letter-spacing: 0.1em; text-transform: uppercase;
    color: #52796f; margin-bottom: 0.5rem;
  }
  .ts-field-wrap { position: relative; }
  .ts-field-icon {
    position: absolute; left: 14px; top: 50%;
    transform: translateY(-50%); color: #84a98c;
    pointer-events: none; display: flex; align-items: center;
  }
  .ts-field-input {
    width: 100%; padding: 0.9rem 1rem 0.9rem 2.8rem;
    border: 1.5px solid #d4ddd6; border-radius: 10px;
    font-family: 'DM Sans', sans-serif; font-size: 16px;
    color: #2f3e46; background: #fff; outline: none;
    transition: border-color 0.2s, box-shadow 0.2s, background 0.2s;
    box-shadow: 0 1px 3px rgba(47,62,70,0.04);
    -webkit-appearance: none; appearance: none;
    box-sizing: border-box;
  }
  .ts-field-input:focus {
    border-color: #52796f;
    box-shadow: 0 0 0 3px rgba(82,121,111,0.12);
  }
  .ts-field-input.ts-has-error {
    border-color: #c0756a;
    box-shadow: 0 0 0 3px rgba(192,117,106,0.10);
  }
  .ts-field-input:disabled { opacity: 0.55; cursor: not-allowed; }
  .ts-field-input-pw { padding-right: 2.8rem; }

  .ts-eye-btn {
    position: absolute; right: 8px; top: 50%;
    transform: translateY(-50%);
    color: #84a98c; background: none; border: none; cursor: pointer;
    display: flex; align-items: center; justify-content: center;
    min-width: 40px; min-height: 40px; padding: 4px;
    -webkit-tap-highlight-color: transparent;
  }
  .ts-eye-btn:active { color: #52796f; }

  .ts-field-error {
    display: flex; align-items: center; gap: 0.3rem;
    margin-top: 0.4rem; font-size: 0.75rem;
    color: #b85c50; font-weight: 400;
  }

  /* ── Alert ── */
  .ts-alert-error {
    border-left: 3px solid #c0756a;
    background: linear-gradient(135deg, #fdf3f2, #fdecea);
    border-radius: 8px; padding: 0.85rem 1rem;
    display: flex; gap: 0.65rem; align-items: flex-start;
  }
  .ts-alert-icon {
    width: 20px; height: 20px; border-radius: 50%;
    background: rgba(192,117,106,0.15);
    display: flex; align-items: center; justify-content: center;
    flex-shrink: 0; margin-top: 1px;
  }
  .ts-alert-text {
    font-size: 0.8rem; color: #7a3028;
    font-weight: 400; line-height: 1.5;
  }

  /* ── Remember/forgot row ── */
  .ts-remember-row {
    display: flex; align-items: center; justify-content: space-between;
    gap: 0.5rem; flex-wrap: wrap;
  }
  .ts-remember-left { display: flex; align-items: center; gap: 0.5rem; }
  .ts-remember-cb {
    accent-color: #52796f;
    width: 18px; height: 18px; cursor: pointer; flex-shrink: 0;
  }
  .ts-remember-label {
    font-size: 0.82rem; color: #52796f;
    font-weight: 400; cursor: pointer;
  }
  .ts-forgot-link {
    font-size: 0.82rem; color: #52796f; font-weight: 500;
    text-decoration: none; padding: 4px 0;
    background: none; border: none; cursor: pointer;
  }

  /* ── Submit button ── */
  .ts-submit-btn {
    width: 100%; padding: 1rem; border: none; border-radius: 10px;
    font-family: 'DM Sans', sans-serif;
    font-size: 0.9rem; font-weight: 600; letter-spacing: 0.04em;
    cursor: pointer;
    transition: transform 0.2s, box-shadow 0.2s;
    display: flex; align-items: center; justify-content: center;
    gap: 0.5rem; min-height: 52px;
    -webkit-tap-highlight-color: transparent;
  }
  .ts-submit-active {
    background: linear-gradient(135deg, #354f52 0%, #52796f 100%);
    color: #cad2c5;
    box-shadow: 0 4px 18px rgba(53,79,82,0.3);
  }
  .ts-submit-active:active { transform: translateY(1px); }
  .ts-submit-disabled {
    background: #d4ddd6; color: #8fa99a;
    cursor: not-allowed; box-shadow: none;
  }
  .ts-spin { animation: ts-spin 0.8s linear infinite; }

  /* ── Footer ── */
  .ts-footer-divider {
    height: 1px;
    background: linear-gradient(90deg, transparent, #d4ddd6, transparent);
    margin: 1.5rem 0 1rem;
  }
  .ts-footer-text {
    font-size: 0.72rem; color: #8fa99a;
    text-align: center; line-height: 1.7; font-weight: 300;
  }
  .ts-powered-row {
    display: flex; align-items: center; justify-content: center;
    gap: 0.5rem; margin-top: 0.75rem;
  }
  .ts-powered-dot {
    width: 5px; height: 5px; border-radius: 50%;
    background: #84a98c; opacity: 0.7;
    animation: ts-pulse 2.5s ease-in-out infinite;
  }
  .ts-powered-dot:last-child { animation-delay: 1s; }
  .ts-powered-text {
    font-size: 0.68rem; color: #8fa99a;
    font-weight: 400; letter-spacing: 0.08em;
  }
`;

function MailIcon() {
  return (
    <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.6" viewBox="0 0 24 24" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 6.75A2.25 2.25 0 014.5 4.5h15a2.25 2.25 0 012.25 2.25v10.5A2.25 2.25 0 0119.5 19.5h-15a2.25 2.25 0 01-2.25-2.25V6.75z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M2.7 7l8.4 6a1.5 1.5 0 001.8 0l8.4-6" />
    </svg>
  );
}

function LockIcon() {
  return (
    <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.6" viewBox="0 0 24 24" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V7.5a4.5 4.5 0 10-9 0v3" />
      <rect x="5.25" y="10.5" width="13.5" height="10.5" rx="2.25" strokeLinejoin="round" />
    </svg>
  );
}

function EyeIcon({ off }) {
  return off ? (
    <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.6" viewBox="0 0 24 24" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 001.934 12c1.292 4.338 5.31 7.5 10.066 7.5 1.794 0 3.487-.45 4.97-1.243M6.228 6.228A10.451 10.451 0 0112 4.5c4.756 0 8.773 3.162 10.066 7.5a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 11-4.243-4.243m4.242 4.242L9.88 9.88" />
    </svg>
  ) : (
    <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.6" viewBox="0 0 24 24" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  );
}

function AlertCircleIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 20 20" fill="#b85c50" aria-hidden="true">
      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
    </svg>
  );
}

function FieldErrorIcon() {
  return (
    <svg width="12" height="12" fill="currentColor" viewBox="0 0 20 20" aria-hidden="true" style={{ flexShrink: 0 }}>
      <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
    </svg>
  );
}

function SubmitSpinner() {
  return (
    <svg className="ts-spin" width="16" height="16" fill="none" viewBox="0 0 24 24" aria-hidden="true" style={{ flexShrink: 0 }}>
      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" style={{ opacity: 0.25 }} />
      <path fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" style={{ opacity: 0.75 }} />
    </svg>
  );
}

const REMEMBERED_EMAIL_KEY = 'hrms.rememberedEmail';

export default function Login({ onLogin }) {
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState({});

  useEffect(() => {
    try {
      const saved = localStorage.getItem(REMEMBERED_EMAIL_KEY);
      if (saved) {
        setIdentifier(saved);
        setRememberMe(true);
      }
    } catch {
      // ignore — localStorage may be unavailable in some webviews
    }
  }, []);

  function validate() {
    const next = {};
    if (!identifier) {
      next.identifier = 'Username or email is required';
    } else if (identifier.includes('@') && !/\S+@\S+\.\S+/.test(identifier)) {
      next.identifier = 'Email is invalid';
    }
    if (!password) {
      next.password = 'Password is required';
    } else if (password.length < 6) {
      next.password = 'Password must be at least 6 characters';
    }
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!validate()) return;
    setSubmitting(true);
    setErrors({});
    try {
      const { data } = await api.post('/auth/login', {
        identifier,
        password,
        rememberMe,
      });

      const payload = data?.data || data;
      const token = payload?.token;
      const userType = payload?.userType;
      const userData = payload?.user;

      if (!token || !userData) {
        throw new Error('Invalid response from server');
      }

      try {
        if (rememberMe) {
          localStorage.setItem(REMEMBERED_EMAIL_KEY, identifier);
        } else {
          localStorage.removeItem(REMEMBERED_EMAIL_KEY);
        }
      } catch {
        // non-fatal
      }

      const mergedUser = { ...userData, userType: userType || userData.userType };
      const userGroup = getUserGroup(mergedUser);

      await setToken(token);
      await setUser({ ...mergedUser, userGroup });
      onLogin(userGroup);
    } catch (err) {
      setErrors({ general: getErrorMessage(err) });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <style>{styles}</style>
      <div className="ts-login">
        {/* Branded header */}
        <header className="ts-header">
          <div className="ts-header-grid" />
          <div className="ts-header-inner ts-anim-down">
            <div className="ts-logo-wrap">
              <img src="/tslnew.png" alt="Talent Shield" />
            </div>
            <div>
              <p className="ts-brand-eyebrow">Human Resource Management</p>
              <h1 className="ts-brand-title">Talent Shield</h1>
            </div>
          </div>
        </header>

        {/* Form area */}
        <main className="ts-form-area">
          <div className="ts-form-card">
            <div className="ts-anim-up" style={{ marginBottom: '1.5rem' }}>
              <h2 className="ts-form-heading">Welcome back</h2>
              <p className="ts-form-sub">Sign in to access your HRMS dashboard</p>
            </div>

            <form
              onSubmit={handleSubmit}
              style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}
              noValidate
            >
              {errors.general && (
                <div className="ts-alert-error ts-anim-shake">
                  <div className="ts-alert-icon">
                    <AlertCircleIcon />
                  </div>
                  <p className="ts-alert-text">{errors.general}</p>
                </div>
              )}

              <div className="ts-anim-up ts-delay-100">
                <label htmlFor="identifier" className="ts-field-label">Username or Email</label>
                <div className="ts-field-wrap">
                  <span className="ts-field-icon"><MailIcon /></span>
                  <input
                    id="identifier"
                    type="text"
                    inputMode="email"
                    autoCapitalize="none"
                    autoCorrect="off"
                    autoComplete="username"
                    value={identifier}
                    onChange={(e) => {
                      setIdentifier(e.target.value);
                      if (errors.identifier) setErrors((p) => ({ ...p, identifier: '' }));
                    }}
                    disabled={submitting}
                    placeholder="Enter your username or email"
                    className={`ts-field-input${errors.identifier ? ' ts-has-error' : ''}`}
                    aria-invalid={!!errors.identifier}
                  />
                </div>
                {errors.identifier && (
                  <p className="ts-field-error">
                    <FieldErrorIcon />
                    {errors.identifier}
                  </p>
                )}
              </div>

              <div className="ts-anim-up ts-delay-200">
                <label htmlFor="password" className="ts-field-label">Password</label>
                <div className="ts-field-wrap">
                  <span className="ts-field-icon"><LockIcon /></span>
                  <input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="current-password"
                    value={password}
                    onChange={(e) => {
                      setPassword(e.target.value);
                      if (errors.password) setErrors((p) => ({ ...p, password: '' }));
                    }}
                    disabled={submitting}
                    placeholder="Enter your password"
                    className={`ts-field-input ts-field-input-pw${errors.password ? ' ts-has-error' : ''}`}
                    aria-invalid={!!errors.password}
                  />
                  <button
                    type="button"
                    className="ts-eye-btn"
                    onClick={() => setShowPassword((s) => !s)}
                    tabIndex={-1}
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                  >
                    <EyeIcon off={showPassword} />
                  </button>
                </div>
                {errors.password && (
                  <p className="ts-field-error">
                    <FieldErrorIcon />
                    {errors.password}
                  </p>
                )}
              </div>

              <div className="ts-remember-row ts-anim-up ts-delay-300">
                <div className="ts-remember-left">
                  <input
                    id="remember-me"
                    type="checkbox"
                    className="ts-remember-cb"
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                    disabled={submitting}
                  />
                  <label htmlFor="remember-me" className="ts-remember-label">Remember me</label>
                </div>
                <button
                  type="button"
                  className="ts-forgot-link"
                  onClick={() => {
                    // Forgot-password flow is a future screen — surface a hint for now.
                    setErrors({ general: 'Password reset is available on the web app.' });
                  }}
                >
                  Forgot password?
                </button>
              </div>

              <div className="ts-anim-up ts-delay-400" style={{ paddingTop: '0.25rem' }}>
                <button
                  type="submit"
                  disabled={submitting}
                  aria-busy={submitting}
                  className={`ts-submit-btn ${submitting ? 'ts-submit-disabled' : 'ts-submit-active'}`}
                >
                  {submitting ? (
                    <>
                      <SubmitSpinner />
                      Signing in…
                    </>
                  ) : (
                    'Sign in'
                  )}
                </button>
              </div>
            </form>

            <div className="ts-anim-up ts-delay-500">
              <div className="ts-footer-divider" />
              <p className="ts-footer-text">
                By signing in, you agree to our Terms of Service and Privacy Policy.
              </p>
              <div className="ts-powered-row">
                <span className="ts-powered-dot" />
                <span className="ts-powered-text">Powered by Vitrux Shield</span>
                <span className="ts-powered-dot" />
              </div>
            </div>
          </div>
        </main>
      </div>
    </>
  );
}
