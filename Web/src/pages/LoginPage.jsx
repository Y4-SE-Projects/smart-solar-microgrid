// File: LoginPage.jsx
// Purpose: Backoffice/GridOperator login screen. Wired to the live POST /api/users/login endpoint.


import { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import apiClient from '../services/api';
import { useAuth } from '../context/AuthContext';
import { Roles, homePathForRole } from '../constants/roles';

export default function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { login, logout } = useAuth();

  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  // Only the pre-submit checks below live here; anything the server decides is reported by a
  // toast instead, so a rejection never shows up twice.
  const [errorMessage, setErrorMessage] = useState('');

  // ProtectedRoute sends a session here when its stored role has no console screens. 
  // Clearing it happens here rather than in the guard, which has to stay free of side effects.
  useEffect(() => {
    if (location.state?.reason === 'ROLE_NOT_SUPPORTED') {
      logout();
      toast.error(
        'That account cannot access the web console. Sign in with a Backoffice or Grid Operator account.'
      );
    }
  }, [location.state, logout]);

  async function handleSubmit(event) {
    event.preventDefault();
    setErrorMessage('');

    // The form uses noValidate, so "required" doesn't stop an empty submit. 
    // Without this check it reached the API, came back as a misleading "Invalid credentials." and used up one of the limited sign-in attempts.
    if (!identifier.trim() && !password) {
      setErrorMessage('Enter your username and password.');
      return;
    }
    if (!identifier.trim()) {
      setErrorMessage('Enter your username.');
      return;
    }
    if (!password) {
      setErrorMessage('Enter your password.');
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await apiClient.post('/users/login', {
        identifier: identifier.trim(),
        password,
      });
      const data = response.data.data;

      // One lookup decides where this role belongs, so adding a console role later means changing homePathForRole and nothing here.
      const home = homePathForRole(data.role);

      // Valid credentials, but the wrong surface for this role. 
      // (The API already refuses a Prosumer signing in with X-Client-Type: Web, so this is the second line of defence.
      if (!home) {
        toast.error(
          data.role === Roles.Prosumer
            ? 'Prosumer accounts sign in through the HelioGrid mobile app, not the web console.'
            : 'This account role is not supported on the web console.'
        );
        return;
      }

      login(data);
      navigate(home, { replace: true });
    } catch (error) {
      toast.error(
        error.response?.data?.message || 'Something went wrong while signing in. Please try again.'
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="min-h-[100dvh] bg-canvas-bg p-3 text-on-surface selection:bg-mint-surface selection:text-primary sm:p-5 lg:p-6">
      <div className="mx-auto grid min-h-[calc(100dvh-1.5rem)] max-w-[1600px] overflow-hidden rounded-[2rem] bg-white shadow-[0_18px_70px_-45px_rgba(0,48,37,0.35)] sm:min-h-[calc(100dvh-2.5rem)] lg:min-h-[calc(100dvh-3rem)] lg:grid-cols-[minmax(0,1.06fr)_minmax(440px,0.94fr)]">
        <aside className="relative isolate flex min-h-[180px] flex-col justify-between overflow-hidden bg-primary p-5 text-white sm:min-h-[220px] sm:p-8 lg:min-h-0 lg:p-10">
          <img
            src="/wp4041839-solar-panel-wallpapers.jpg"
            alt=""
            className="absolute inset-0 -z-20 h-full w-full object-cover object-center"
          />
          <div className="absolute inset-0 -z-10 bg-gradient-to-b from-[#032c24]/75 via-[#032c24]/30 to-[#032c24]/90" />

          <Link to="/" className="inline-flex w-fit items-center gap-2 rounded-full text-white focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white">
            <img src="/logo.svg" alt="" className="h-8 w-8 rounded-full" />
            <span className="font-['Plus_Jakarta_Sans',Arial,sans-serif] text-lg font-bold tracking-tight">HelioGrid</span>
          </Link>

          <div className="max-w-xl pt-5 font-['Plus_Jakarta_Sans',Arial,sans-serif]">
            <h2 className="text-2xl font-semibold leading-tight tracking-tight sm:text-3xl lg:text-[clamp(2.2rem,3.5vw,4rem)]">
              The people behind a<br className="hidden xl:block" />{' '}
              <span className="font-['Newsreader',Georgia,serif] font-normal italic leading-[1.15] text-emerald-200">greener grid.</span>
            </h2>
            <p className="mt-2 hidden max-w-md text-sm leading-relaxed text-white/85 sm:block">
              Keep stations, energy slots, and reservations connected through one operations workspace.
            </p>
          </div>
        </aside>

        <div className="flex min-w-0 flex-col bg-white px-5 py-5 sm:px-10 sm:py-7 lg:px-12 lg:py-6">
          <header className="flex justify-end">
            <Link
              to="/"
              className="inline-flex min-h-10 items-center gap-2 rounded-full border border-border-slate bg-canvas-bg px-4 text-sm font-semibold text-primary transition-colors hover:border-primary/25 hover:bg-mint-surface focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-secondary"
            >
              <span aria-hidden="true">←</span>
              Back to home
            </Link>
          </header>

          <main className="mx-auto flex w-full max-w-[440px] flex-1 flex-col justify-center py-6 sm:py-8 lg:py-4">
            <div className="mb-5">
              <div className="mb-3 inline-flex items-center rounded-full bg-mint-surface px-3 py-1.5 text-xs font-semibold text-primary">
                Operations console
              </div>
              <h1 className="font-['Plus_Jakarta_Sans',Arial,sans-serif] text-3xl font-bold leading-tight tracking-tight text-primary sm:text-4xl">
                Welcome back.
              </h1>
              <p className="mt-2 text-sm leading-relaxed text-on-surface-variant">
                Sign in to manage your HelioGrid workspace.
              </p>
            </div>

            <form className="space-y-4" onSubmit={handleSubmit} noValidate>
              {/* Identifier */}
              <div className="space-y-2">
                <label className="text-sm font-semibold text-on-surface" htmlFor="identity-input">
                  Username
                </label>
                <div className="relative flex items-center">
                  <input
                    id="identity-input"
                    name="identity"
                    type="text"
                    autoComplete="username"
                    required
                    value={identifier}
                    // Usernames are stored in lower case, so the field shows what the account is actually called.
                    onChange={(event) => setIdentifier(event.target.value.toLowerCase())}
                    autoCapitalize="none"
                    spellCheck={false}
                    placeholder="e.g. admin.jsmith"
                    className="h-11 w-full rounded-xl border border-border-slate bg-canvas-bg pl-4 pr-12 text-sm text-on-surface placeholder:text-outline focus:border-secondary focus:bg-white focus:outline-2 focus:outline-offset-2 focus:outline-secondary/45"
                  />
                </div>
              </div>

              {/* Password */}
              <div className="space-y-2">
                <label className="text-sm font-semibold text-on-surface" htmlFor="password-input">
                  Password
                </label>
                <div className="relative flex items-center">
                  <input
                    id="password-input"
                    name="password"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="current-password"
                    required
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    placeholder="••••••••••••"
                    className="h-11 w-full rounded-xl border border-border-slate bg-canvas-bg pl-4 pr-12 text-sm text-on-surface placeholder:text-outline focus:border-secondary focus:bg-white focus:outline-2 focus:outline-offset-2 focus:outline-secondary/45"
                  />
                  <button
                    type="button"
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                    aria-pressed={showPassword}
                    onClick={() => setShowPassword((prev) => !prev)}
                    className="absolute right-3 flex items-center justify-center rounded-md p-1 text-on-surface-variant transition-colors hover:text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-secondary"
                  >
                    <span className="material-symbols-outlined text-[20px]" aria-hidden="true">
                      {showPassword ? 'visibility_off' : 'visibility'}
                    </span>
                  </button>
                </div>
              </div>

              {/* Error */}
              {errorMessage && (
                <div
                  role="alert"
                  className="flex items-start gap-2 rounded-xl bg-error-container px-4 py-3 text-sm text-on-error-container"
                >
                  <span>{errorMessage}</span>
                </div>
              )}

              {/* Submit */}
              <button
                type="submit"
                disabled={isSubmitting}
                className="group mt-1 flex min-h-11 w-full items-center justify-center gap-2 rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-on-primary transition-colors hover:bg-primary-container focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-secondary disabled:cursor-not-allowed disabled:opacity-70"
              >
                {isSubmitting ? (
                  <>
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white motion-reduce:animate-none" aria-hidden="true" />
                    <span>Signing in...</span>
                  </>
                ) : (
                  <>
                    <span>Sign In</span>
                    <span className="transition-transform group-hover:translate-x-1 motion-reduce:transform-none" aria-hidden="true">→</span>
                  </>
                )}
              </button>
            </form>

            <div className="mt-5 border-t border-border-slate pt-4 text-xs text-on-surface-variant">
              Console access for <span className="font-semibold text-primary">Backoffice</span> and <span className="font-semibold text-primary">Grid Operators</span>
            </div>
          </main>

          <footer className="text-center text-xs text-outline sm:text-left">
            © HelioGrid Web Console
          </footer>
        </div>
      </div>
    </div>
  );
}
