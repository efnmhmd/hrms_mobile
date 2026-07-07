import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../utils/api';
import { getErrorMessage } from '../utils/errorHandler';

const styles = `
  .fp-screen {
    font-family: 'DM Sans', sans-serif;
    -webkit-text-size-adjust: 100%;
    display: flex;
    flex-direction: column;
    min-height: 100%;
    background: #f7f8f6;
  }

  @keyframes fp-fadeUp {
    from { opacity: 0; transform: translateY(16px); }
    to   { opacity: 1; transform: translateY(0); }
  }
  @keyframes fp-slideDown {
    from { opacity: 0; transform: translateY(-12px); }
    to   { opacity: 1; transform: translateY(0); }
  }
  @keyframes fp-shake {
    0%, 100% { transform: translateX(0); }
    20% { transform: translateX(-5px); }
    40% { transform: translateX(5px); }
    60% { transform: translateX(-3px); }
    80% { transform: translateX(3px); }
  }
  @keyframes fp-spin { to { transform: rotate(360deg); } }
  @keyframes fp-pulse {
    0%, 100% { opacity: 0.4; transform: scale(1); }
    50%      { opacity: 0.8; transform: scale(1.08); }
  }
  @keyframes fp-pop {
    0%   { opacity: 0; transform: scale(0.6); }
    60%  { transform: scale(1.08); }
    100% { opacity: 1; transform: scale(1); }
  }

  .fp-anim-up    { animation: fp-fadeUp 0.55s cubic-bezier(0.22,1,0.36,1) both; }
  .fp-anim-down  { animation: fp-slideDown 0.5s cubic-bezier(0.22,1,0.36,1) both; }
  .fp-anim-shake { animation: fp-shake 0.45s ease; }
  .fp-anim-pop   { animation: fp-pop 0.5s cubic-bezier(0.22,1,0.36,1) both; }
  .fp-delay-100 { animation-delay: 0.10s; }
  .fp-delay-200 { animation-delay: 0.20s; }
  .fp-delay-300 { animation-delay: 0.30s; }
  .fp-delay-400 { animation-delay: 0.40s; }

  /* ── Header strip ── */
  .fp-header {
    background: #2f3e46;
    position: relative;
    overflow: hidden;
    padding: calc(1.25rem + env(safe-area-inset-top)) 1.25rem 1.6rem;
  }
  .fp-header::before {
    content: ''; position: absolute; inset: 0;
    background:
      radial-gradient(ellipse at 10% 50%, rgba(82,121,111,0.4) 0%, transparent 60%),
      radial-gradient(ellipse at 90% 10%, rgba(53,79,82,0.5) 0%, transparent 50%);
    pointer-events: none;
  }
  .fp-header-grid {
    position: absolute; inset: 0;
    background-image:
      linear-gradient(rgba(202,210,197,0.04) 1px, transparent 1px),
      linear-gradient(90deg, rgba(202,210,197,0.04) 1px, transparent 1px);
    background-size: 32px 32px; pointer-events: none;
  }
  .fp-header-inner {
    position: relative; z-index: 1;
    display: flex; align-items: center; gap: 1rem;
  }
  .fp-logo-wrap {
    width: 52px; height: 52px; border-radius: 14px;
    background: rgba(202,210,197,0.10);
    border: 1px solid rgba(202,210,197,0.18);
    display: flex; align-items: center; justify-content: center;
    backdrop-filter: blur(8px); flex-shrink: 0;
    overflow: hidden;
  }
  .fp-logo-wrap img { width: 100%; height: 100%; object-fit: contain; }
  .fp-brand-eyebrow {
    font-size: 0.6rem; font-weight: 500; letter-spacing: 0.18em;
    text-transform: uppercase; color: #84a98c; margin-bottom: 0.15rem;
  }
  .fp-brand-title {
    font-family: 'Cormorant Garamond', serif; font-weight: 300;
    font-size: 1.6rem; line-height: 1.1; color: #cad2c5;
    letter-spacing: -0.01em; margin: 0;
  }

  /* ── Form area ── */
  .fp-form-area {
    flex: 1;
    background: #f7f8f6;
    position: relative;
    padding: 1.75rem 1.25rem;
    padding-bottom: max(1.75rem, calc(1rem + env(safe-area-inset-bottom)));
  }
  .fp-form-area::before {
    content: ''; position: absolute; inset: 0;
    background: radial-gradient(ellipse at 70% 0%, rgba(132,169,140,0.10) 0%, transparent 55%);
    pointer-events: none;
  }
  .fp-form-card { position: relative; z-index: 1; max-width: 480px; margin: 0 auto; }

  /* ── Back link ── */
  .fp-back-link {
    display: inline-flex; align-items: center; gap: 0.4rem;
    font-size: 0.8rem; font-weight: 500;
    color: #52796f; background: none; border: none; cursor: pointer;
    padding: 0.4rem 0; margin-bottom: 1rem;
    -webkit-tap-highlight-color: transparent;
  }
  .fp-back-link:active { color: #354f52; }

  .fp-icon-circle {
    width: 52px; height: 52px; border-radius: 14px;
    background: linear-gradient(135deg, #354f52, #52796f);
    border: 1px solid rgba(132,169,140,0.3);
    display: flex; align-items: center; justify-content: center;
    box-shadow: 0 4px 14px rgba(47,62,70,0.25);
    margin-bottom: 1rem;
  }

  .fp-heading {
    font-family: 'Cormorant Garamond', serif;
    font-size: 1.6rem; font-weight: 400; color: #2f3e46;
    letter-spacing: -0.02em; line-height: 1.2; margin: 0;
  }
  .fp-sub {
    font-size: 0.8rem; color: #7a8e84; font-weight: 300;
    margin: 0.3rem 0 0; line-height: 1.5;
  }

  /* ── Inputs ── */
  .fp-field-label {
    display: block; font-size: 0.7rem; font-weight: 600;
    letter-spacing: 0.1em; text-transform: uppercase;
    color: #52796f; margin-bottom: 0.5rem;
  }
  .fp-field-wrap { position: relative; }
  .fp-field-icon {
    position: absolute; left: 14px; top: 50%;
    transform: translateY(-50%); color: #84a98c;
    pointer-events: none; display: flex; align-items: center;
  }
  .fp-field-input {
    width: 100%; padding: 0.9rem 1rem 0.9rem 2.8rem;
    border: 1.5px solid #d4ddd6; border-radius: 10px;
    font-family: 'DM Sans', sans-serif; font-size: 16px;
    color: #2f3e46; background: #fff; outline: none;
    transition: border-color 0.2s, box-shadow 0.2s, background 0.2s;
    box-shadow: 0 1px 3px rgba(47,62,70,0.04);
    -webkit-appearance: none; appearance: none;
    box-sizing: border-box;
  }
  .fp-field-input:focus {
    border-color: #52796f;
    box-shadow: 0 0 0 3px rgba(82,121,111,0.12);
  }
  .fp-field-input.fp-has-error {
    border-color: #c0756a;
    box-shadow: 0 0 0 3px rgba(192,117,106,0.10);
  }
  .fp-field-input:disabled { opacity: 0.55; cursor: not-allowed; }

  .fp-field-error {
    display: flex; align-items: center; gap: 0.3rem;
    margin-top: 0.4rem; font-size: 0.75rem;
    color: #b85c50; font-weight: 400;
  }

  /* ── Alerts ── */
  .fp-alert-error {
    border-left: 3px solid #c0756a;
    background: linear-gradient(135deg, #fdf3f2, #fdecea);
    border-radius: 8px; padding: 0.85rem 1rem;
    display: flex; gap: 0.65rem; align-items: flex-start;
  }
  .fp-alert-icon {
    width: 20px; height: 20px; border-radius: 50%;
    background: rgba(192,117,106,0.15);
    display: flex; align-items: center; justify-content: center;
    flex-shrink: 0; margin-top: 1px;
  }
  .fp-alert-text {
    font-size: 0.8rem; color: #7a3028;
    font-weight: 400; line-height: 1.5;
  }

  /* ── Submit button ── */
  .fp-submit-btn {
    width: 100%; padding: 1rem; border: none; border-radius: 10px;
    font-family: 'DM Sans', sans-serif;
    font-size: 0.9rem; font-weight: 600; letter-spacing: 0.04em;
    cursor: pointer;
    transition: transform 0.2s, box-shadow 0.2s;
    display: flex; align-items: center; justify-content: center;
    gap: 0.5rem; min-height: 52px;
    -webkit-tap-highlight-color: transparent;
  }
  .fp-submit-active {
    background: linear-gradient(135deg, #354f52 0%, #52796f 100%);
    color: #cad2c5;
    box-shadow: 0 4px 18px rgba(53,79,82,0.3);
  }
  .fp-submit-active:active { transform: translateY(1px); }
  .fp-submit-disabled {
    background: #d4ddd6; color: #8fa99a;
    cursor: not-allowed; box-shadow: none;
  }
  .fp-spin { animation: fp-spin 0.8s linear infinite; }

  /* ── Success state ── */
  .fp-success-check {
    width: 72px; height: 72px; border-radius: 50%;
    background: linear-gradient(135deg, #52796f, #84a98c);
    display: flex; align-items: center; justify-content: center;
    box-shadow: 0 6px 22px rgba(82,121,111,0.35);
    margin: 0 auto 1.25rem;
  }
  .fp-success-email {
    font-weight: 600; color: #354f52; word-break: break-all;
  }
  .fp-resend-btn {
    background: none; border: none; cursor: pointer;
    color: #52796f; font-weight: 600; font-size: 0.82rem;
    font-family: 'DM Sans', sans-serif; padding: 4px 0;
    -webkit-tap-highlight-color: transparent;
  }
  .fp-resend-btn:disabled { color: #8fa99a; cursor: not-allowed; }

  /* ── Footer ── */
  .fp-footer-divider {
    height: 1px;
    background: linear-gradient(90deg, transparent, #d4ddd6, transparent);
    margin: 1.5rem 0 1rem;
  }
  .fp-powered-row {
    display: flex; align-items: center; justify-content: center;
    gap: 0.5rem; margin-top: 0.75rem;
  }
  .fp-powered-dot {
    width: 5px; height: 5px; border-radius: 50%;
    background: #84a98c; opacity: 0.7;
    animation: fp-pulse 2.5s ease-in-out infinite;
  }
  .fp-powered-dot:last-child { animation-delay: 1s; }
  .fp-powered-text {
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

function BackArrowIcon() {
  return (
    <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="M19 12H5m0 0l7 7m-7-7l7-7" />
    </svg>
  );
}

function SendIcon() {
  return (
    <svg width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24" aria-hidden="true" style={{ flexShrink: 0 }}>
      <line x1="22" y1="2" x2="11" y2="13" />
      <polygon points="22 2 15 22 11 13 2 9 22 2" />
    </svg>
  );
}

function HeaderMailIcon() {
  return (
    <svg width="24" height="24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24" aria-hidden="true" style={{ color: '#cad2c5' }}>
      <path d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg width="34" height="34" fill="none" stroke="#f7f8f6" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M20 6L9 17l-5-5" />
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
    <svg className="fp-spin" width="16" height="16" fill="none" viewBox="0 0 24 24" aria-hidden="true" style={{ flexShrink: 0 }}>
      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" style={{ opacity: 0.25 }} />
      <path fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" style={{ opacity: 0.75 }} />
    </svg>
  );
}

export default function ForgotPassword() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [sent, setSent] = useState(false);

  function goToLogin() {
    navigate('/', { replace: true });
  }

  async function handleSubmit(e) {
    e.preventDefault();
    const trimmed = email.trim();
    if (!trimmed) {
      setError('Please enter your email address');
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      setError('Please enter a valid email address');
      return;
    }

    setSubmitting(true);
    setError('');
    try {
      // Backend always returns 200 with a generic message (anti-enumeration);
      // the reset link is emailed and completes on the web reset page.
      await api.post('/auth/forgot-password', { email: trimmed });
      setSent(true);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <style>{styles}</style>
      <div className="fp-screen">
        {/* Branded header */}
        <header className="fp-header">
          <div className="fp-header-grid" />
          <div className="fp-header-inner fp-anim-down">
            <div className="fp-logo-wrap">
              <img src="/tslnew.png" alt="Talent Shield" />
            </div>
            <div>
              <p className="fp-brand-eyebrow">Human Resource Management</p>
              <h1 className="fp-brand-title">Talent Shield</h1>
            </div>
          </div>
        </header>

        {/* Form area */}
        <main className="fp-form-area">
          <div className="fp-form-card">
            {!sent ? (
              <>
                <button type="button" className="fp-back-link fp-anim-up" onClick={goToLogin}>
                  <BackArrowIcon />
                  Back to sign in
                </button>

                <div className="fp-anim-up fp-delay-100" style={{ marginBottom: '1.5rem' }}>
                  <div className="fp-icon-circle">
                    <HeaderMailIcon />
                  </div>
                  <h2 className="fp-heading">Reset your password</h2>
                  <p className="fp-sub">
                    Enter the email linked to your account and we&apos;ll send you a link to get back in.
                  </p>
                </div>

                <form
                  onSubmit={handleSubmit}
                  style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}
                  noValidate
                >
                  {error && (
                    <div className="fp-alert-error fp-anim-shake">
                      <div className="fp-alert-icon">
                        <AlertCircleIcon />
                      </div>
                      <p className="fp-alert-text">{error}</p>
                    </div>
                  )}

                  <div className="fp-anim-up fp-delay-200">
                    <label htmlFor="fp-email" className="fp-field-label">Email address</label>
                    <div className="fp-field-wrap">
                      <span className="fp-field-icon"><MailIcon /></span>
                      <input
                        id="fp-email"
                        type="email"
                        inputMode="email"
                        autoCapitalize="none"
                        autoCorrect="off"
                        autoComplete="email"
                        value={email}
                        onChange={(e) => {
                          setEmail(e.target.value);
                          if (error) setError('');
                        }}
                        disabled={submitting}
                        placeholder="Enter your registered email"
                        className={`fp-field-input${error ? ' fp-has-error' : ''}`}
                        aria-invalid={!!error}
                      />
                    </div>
                  </div>

                  <div className="fp-anim-up fp-delay-300" style={{ paddingTop: '0.25rem' }}>
                    <button
                      type="submit"
                      disabled={submitting}
                      aria-busy={submitting}
                      className={`fp-submit-btn ${submitting ? 'fp-submit-disabled' : 'fp-submit-active'}`}
                    >
                      {submitting ? (
                        <>
                          <SubmitSpinner />
                          Sending reset link…
                        </>
                      ) : (
                        <>
                          <SendIcon />
                          Send reset link
                        </>
                      )}
                    </button>
                  </div>
                </form>
              </>
            ) : (
              <div className="fp-anim-up" style={{ textAlign: 'center', paddingTop: '0.5rem' }}>
                <div className="fp-success-check fp-anim-pop">
                  <CheckIcon />
                </div>
                <h2 className="fp-heading">Check your email</h2>
                <p className="fp-sub" style={{ marginBottom: '0.25rem' }}>
                  If an account exists for
                </p>
                <p className="fp-success-email">{email.trim()}</p>
                <p className="fp-sub" style={{ marginTop: '0.75rem' }}>
                  we&apos;ve sent a password reset link. Open it on this device to choose a new
                  password, then return here to sign in. The link expires in 1&nbsp;hour.
                </p>

                <div style={{ marginTop: '1.5rem', display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
                  <button
                    type="button"
                    className="fp-submit-btn fp-submit-active"
                    onClick={goToLogin}
                  >
                    Back to sign in
                  </button>
                  <p className="fp-sub" style={{ margin: 0 }}>
                    Didn&apos;t get it?{' '}
                    <button
                      type="button"
                      className="fp-resend-btn"
                      disabled={submitting}
                      onClick={() => { setSent(false); setError(''); }}
                    >
                      Try another email
                    </button>
                  </p>
                </div>
              </div>
            )}

            <div className="fp-anim-up fp-delay-400">
              <div className="fp-footer-divider" />
              <div className="fp-powered-row">
                <span className="fp-powered-dot" />
                <span className="fp-powered-text">Powered by Vitrux Shield</span>
                <span className="fp-powered-dot" />
              </div>
            </div>
          </div>
        </main>
      </div>
    </>
  );
}
