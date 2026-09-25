/* File: LoginPage.jsx
 * Purpose: Backoffice/GridOperator login screen.
 * Wired to the live POST /api/users/login endpoint.
 */

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import apiClient from '../services/api';
import { useAuth } from '../context/AuthContext';
import { Roles } from '../constants/roles';

export default function LoginPage() {
  const navigate = useNavigate();
  const { login } = useAuth();

  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  async function handleSubmit(event) {
    event.preventDefault();
    setErrorMessage('');
    setIsSubmitting(true);

    try {
      const response = await apiClient.post('/users/login', {
        identifier: identifier.trim(),
        password,
      });
      const data = response.data.data;

      if (data.role === Roles.Backoffice) {
        login(data);
        navigate('/stations', { replace: true });
        return;
      }

      if (data.role === Roles.GridOperator) {
        login(data);
        navigate('/schedules', { replace: true });
        return;
      }

      // Valid credentials, but the wrong surface for this role.
      if (data.role === Roles.Prosumer) {
        setErrorMessage('Prosumer accounts sign in through the HelioGrid mobile app, not the web console.');
      } else {
        setErrorMessage('This account role is not supported on the web console.');
      }
    } catch (error) {
      const apiMessage = error.response?.data?.message;
      setErrorMessage(apiMessage || 'Something went wrong while signing in. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen bg-canvas-bg text-on-surface flex flex-col justify-between selection:bg-mint-surface selection:text-primary">
      {/* Header */}
      <header className="w-full pt-margin-lg pb-space-lg px-gutter flex flex-col items-center justify-center">
        <div className="flex items-center gap-space-sm mb-space-sm">
          <img src="/logo.svg" alt="HelioGrid logo" className="h-9 w-9 object-contain"/>
          <span className="text-headline-sm font-semibold text-primary tracking-tight">HelioGrid</span>
        </div>
      </header>

      {/* Main */}
      <main className="w-full flex-1 flex flex-col items-center justify-center px-gutter py-space-xl">
        <div className="relative w-full max-w-lg mx-auto flex flex-col items-center">
          {/* Ambient backdrop */}
          <div className="absolute -top-16 left-1/2 -translate-x-1/2 w-96 h-96 bg-primary/5 rounded-full blur-3xl pointer-events-none -z-10" />
          <div className="absolute -bottom-10 right-0 w-72 h-72 bg-mint-surface/20 rounded-full blur-2xl pointer-events-none -z-10" />

          {/* Title */}
          <div className="mb-space-lg flex flex-col items-center text-center">
            <h1 className="text-headline-md font-semibold text-primary tracking-tight">Operations Console Login</h1>
            <p className="text-body-md text-on-surface-variant mt-1">Enter your credentials to access the console</p>
          </div>

          {/* Auth card */}
          <div className="w-full bg-surface-container-lowest rounded-2xl p-space-xl sm:p-margin-lg shadow-xl shadow-primary/5">
            <form className="space-y-space-md" onSubmit={handleSubmit} noValidate>
              {/* Identifier */}
              <div className="space-y-1">
                <label className="text-label-md font-medium text-on-surface" htmlFor="identity-input">
                  Username
                </label>
                <div className="relative flex items-center">
                  <span className="material-symbols-outlined absolute left-space-md text-on-surface-variant pointer-events-none text-[18px]">
                    badge
                  </span>
                  <input
                    id="identity-input"
                    name="identity"
                    type="text"
                    autoComplete="username"
                    required
                    value={identifier}
                    onChange={(event) => setIdentifier(event.target.value)}
                    placeholder="e.g. admin.jsmith"
                    className="w-full h-11 pl-10 pr-space-md bg-canvas-bg text-on-surface text-body-md rounded-xl focus:outline-none focus:bg-surface-container-lowest focus:shadow-[0_0_0_2px_#006c4a] transition-all"
                  />
                </div>
              </div>

              {/* Password */}
              <div className="space-y-1">
                <label className="text-label-md font-medium text-on-surface" htmlFor="password-input">
                  Password
                </label>
                <div className="relative flex items-center">
                  <span className="material-symbols-outlined absolute left-space-md text-on-surface-variant pointer-events-none text-[18px]">
                    lock
                  </span>
                  <input
                    id="password-input"
                    name="password"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="current-password"
                    required
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    placeholder="••••••••••••"
                    className="w-full h-11 pl-10 pr-11 bg-canvas-bg text-on-surface text-body-md rounded-xl focus:outline-none focus:bg-surface-container-lowest focus:shadow-[0_0_0_2px_#006c4a] transition-all"
                  />
                  <button
                    type="button"
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                    onClick={() => setShowPassword((prev) => !prev)}
                    className="absolute right-3 p-1 text-on-surface-variant hover:text-primary transition-colors focus:outline-none flex items-center justify-center"
                  >
                    <span className="material-symbols-outlined text-[20px]">
                      {showPassword ? 'visibility_off' : 'visibility'}
                    </span>
                  </button>
                </div>
              </div>

              {/* Error */}
              {errorMessage && (
                <div
                  role="alert"
                  className="flex items-start gap-2 px-space-md py-space-sm bg-error-container text-on-error-container rounded-xl text-body-sm"
                >
                  <span className="material-symbols-outlined text-[18px] mt-0.5">error</span>
                  <span>{errorMessage}</span>
                </div>
              )}

              {/* Submit */}
              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full mt-2 py-3 px-space-lg bg-primary text-on-primary hover:bg-primary-container active:scale-[0.99] disabled:opacity-70 disabled:cursor-not-allowed font-semibold text-headline-sm rounded-full shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-2 group"
              >
                {isSubmitting ? (
                  <>
                    <svg className="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                    </svg>
                    <span>Signing in...</span>
                  </>
                ) : (
                  <>
                    <span>Sign In</span>
                    <span className="material-symbols-outlined text-[20px] transition-transform group-hover:translate-x-1">
                      arrow_forward
                    </span>
                  </>
                )}
              </button>
            </form>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="w-full py-space-xl px-gutter flex flex-col sm:flex-row items-center justify-between max-w-7xl mx-auto gap-space-md text-center sm:text-left">
        <div className="w-full flex items-center justify-center text-on-surface-variant text-body-sm">
          <span className="text-outline-variant">© HelioGrid Web Console</span>
        </div>
      </footer>
    </div>
  );
}