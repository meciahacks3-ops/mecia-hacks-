'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';

export default function LoginPage() {
  const router = useRouter();
  const [role, setRole] = useState('student'); // 'student', 'judge', 'admin'
  const [themeMode, setThemeMode] = useState('arcade');
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  // Login form state
  const [studentId, setStudentId] = useState('');
  const [judgeEmail, setJudgeEmail] = useState('');
  const [adminUser, setAdminUser] = useState('');

  useEffect(() => {
    // Check Theme Preference
    const storedTheme = localStorage.getItem('themeMode') || 'arcade';
    setThemeMode(storedTheme);
    if (storedTheme === 'simple') {
      document.body.classList.add('simple-theme');
    } else {
      document.body.classList.remove('simple-theme');
    }

    // Check for Google OAuth returning session
    const checkOAuthSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        const userEmail = session.user.email || session.user.user_metadata?.email;
        sessionStorage.setItem('studentId', userEmail);
        sessionStorage.setItem('judgeEmail', userEmail);
        try {
          await supabase.from('user_logins').insert([{ role: 'google_oauth', user_identifier: userEmail }]);
        } catch (e) {
          console.warn("Supabase OAuth login log warning:", e);
        }
        router.push('/project-submission');
      }
    };
    checkOAuthSession();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (session?.user) {
        const userEmail = session.user.email || session.user.user_metadata?.email;
        sessionStorage.setItem('studentId', userEmail);
        sessionStorage.setItem('judgeEmail', userEmail);
        router.push('/project-submission');
      }
    });

    return () => subscription.unsubscribe();
  }, [router]);

  const toggleTheme = () => {
    const nextTheme = themeMode === 'simple' ? 'arcade' : 'simple';
    setThemeMode(nextTheme);
    localStorage.setItem('themeMode', nextTheme);
    if (nextTheme === 'simple') {
      document.body.classList.add('simple-theme');
    } else {
      document.body.classList.remove('simple-theme');
    }
  };

  const handleGoogleOAuth = async () => {
    setIsLoggingIn(true);
    try {
      const redirectUrl = process.env.NEXT_PUBLIC_SITE_URL || (typeof window !== 'undefined' ? window.location.origin : 'https://mecia-hacks.vercel.app');
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: redirectUrl,
        },
      });
      if (error) throw error;
    } catch (err) {
      console.error("Google OAuth error:", err.message);
      alert("Google OAuth: " + err.message);
      setIsLoggingIn(false);
    }
  };

  const handleStudentLogin = async (e) => {
    e.preventDefault();
    setIsLoggingIn(true);
    setTimeout(async () => {
      if (studentId) {
        sessionStorage.setItem('studentId', studentId);
        try {
          await supabase.from('user_logins').insert([{ role: 'student', user_identifier: studentId }]);
        } catch (err) {
          console.warn("Supabase login tracking warning:", err);
        }
      }
      setIsLoggingIn(false);
      router.push('/project-submission');
    }, 450);
  };

  const handleJudgeLogin = async (e) => {
    e.preventDefault();
    setIsLoggingIn(true);
    setTimeout(async () => {
      const email = judgeEmail || 'judge@eval.org';
      sessionStorage.setItem('judgeEmail', email);
      try {
        await supabase.from('user_logins').insert([{ role: 'judge', user_identifier: email }]);
      } catch (err) {
        console.warn("Supabase login tracking warning:", err);
      }
      setIsLoggingIn(false);
      router.push('/judge-dashboard');
    }, 450);
  };

  const handleAdminLogin = async (e) => {
    e.preventDefault();
    setIsLoggingIn(true);
    setTimeout(async () => {
      const user = adminUser || 'admin_user';
      sessionStorage.setItem('adminUser', user);
      try {
        await supabase.from('user_logins').insert([{ role: 'admin', user_identifier: user }]);
      } catch (err) {
        console.warn("Supabase login tracking warning:", err);
      }
      setIsLoggingIn(false);
      router.push('/admin-dashboard');
    }, 450);
  };

  return (
    <>
      <div className="scanlines"></div>

      <div className="arcade-marquee">
        <div className="pacman-runner">
          <div className="ghost blinky"></div>
          <div className="ghost pinky"></div>
          <div className="ghost inky"></div>
          <div className="ghost clyde"></div>
          <div className="pacman"></div>
        </div>
        <div className="pellet-line">
          <span>•</span><span>•</span><span>•</span><span>•</span><span>•</span>
          <span>•</span><span>•</span><span>•</span><span>•</span><span>•</span>
          <span>•</span><span>•</span><span>•</span><span>•</span><span>•</span>
          <span className="power-pellet">●</span>
          <span>•</span><span>•</span><span>•</span><span>•</span><span>•</span>
        </div>
      </div>

      <div className="login-container">
        <div className="arcade-hud">
          <span>1UP <span className="hud-yellow">00300</span></span>
          <span className="blink-text">READY!</span>
          <span>HIGH SCORE <span className="hud-yellow">99990</span></span>
        </div>

        <div className="login-header">
          <div className="badge-wrapper">
            <span className="role-badge" id="role-badge">
              {role === 'student' && 'STAGE 1: STUDENT'}
              {role === 'judge' && 'STAGE 2: JUDGE'}
              {role === 'admin' && 'STAGE 3: ADMIN'}
            </span>
          </div>
          <h2>Mecia Hack 3.0</h2>
          <p>
            {role === 'student' && 'Access your project dashboard and submit entries.'}
            {role === 'judge' && 'Evaluate hackathon submissions and score projects.'}
            {role === 'admin' && 'Manage events, teams, and administrative settings.'}
          </p>
        </div>

        {/* Theme Toggle Bar */}
        <div className="theme-toggle-bar">
          <button type="button" className="theme-toggle-btn" onClick={toggleTheme}>
            {themeMode === 'simple' ? '🕹️ SWITCH TO ARCADE THEME' : '🌗 CONVERT TO SIMPLE THEME'}
          </button>
        </div>

        {/* Role Selection Tabs */}
        <div className="role-tabs">
          <button
            type="button"
            className={`tab-btn student-tab ${role === 'student' ? 'active' : ''}`}
            onClick={() => setRole('student')}
          >
            <span className="tab-ghost red-ghost"></span> Student
          </button>
          <button
            type="button"
            className={`tab-btn judge-tab ${role === 'judge' ? 'active' : ''}`}
            onClick={() => setRole('judge')}
          >
            <span className="tab-ghost cyan-ghost"></span> Judge
          </button>
          <button
            type="button"
            className={`tab-btn admin-tab ${role === 'admin' ? 'active' : ''}`}
            onClick={() => setRole('admin')}
          >
            <span className="tab-ghost pink-ghost"></span> Admin
          </button>
        </div>

        {/* 1. Student Login Form */}
        {role === 'student' && (
          <form className="login-form active" onSubmit={handleStudentLogin}>
            <div className="form-group">
              <label htmlFor="student-id">Student ID / Roll No.</label>
              <input
                type="text"
                id="student-id"
                placeholder="e.g., STU2026101"
                required
                value={studentId}
                onChange={(e) => setStudentId(e.target.value)}
              />
            </div>
            <div className="form-group">
              <label htmlFor="student-pass">Password</label>
              <input type="password" id="student-pass" placeholder="••••••••" required />
            </div>
            <div className="form-footer">
              <label><input type="checkbox" /> Remember me</label>
              <a href="#">Forgot Password?</a>
            </div>
            <button
              type="submit"
              className="submit-btn"
              disabled={isLoggingIn}
            >
              <span className="pacman-icon"></span> LOGIN
            </button>

            <div className="oauth-divider">
              <span>OR SINGLE SIGN-ON</span>
            </div>

            <button
              type="button"
              className="google-oauth-btn"
              onClick={handleGoogleOAuth}
              disabled={isLoggingIn}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" fill="#FBBC05"/>
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" fill="#EA4335"/>
              </svg>
              CONTINUE WITH GOOGLE
            </button>
          </form>
        )}

        {/* 2. Judge Login Form */}
        {role === 'judge' && (
          <form className="login-form active" onSubmit={handleJudgeLogin}>
            <div className="form-group">
              <label htmlFor="judge-email">Judge Email</label>
              <input
                type="email"
                id="judge-email"
                placeholder="judge@eval.org"
                required
                value={judgeEmail}
                onChange={(e) => setJudgeEmail(e.target.value)}
              />
            </div>
            <div className="form-group">
              <label htmlFor="judge-pass">Access Code / Password</label>
              <input type="password" id="judge-pass" placeholder="••••••••" required />
            </div>
            <div className="form-footer">
              <label><input type="checkbox" /> Remember me</label>
              <a href="#">Request Code reset</a>
            </div>
            <button
              type="submit"
              className="submit-btn"
              disabled={isLoggingIn}
            >
              <span className="pacman-icon"></span> LOGIN
            </button>

            <div className="oauth-divider">
              <span>OR SINGLE SIGN-ON</span>
            </div>

            <button
              type="button"
              className="google-oauth-btn"
              onClick={handleGoogleOAuth}
              disabled={isLoggingIn}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" fill="#FBBC05"/>
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" fill="#EA4335"/>
              </svg>
              CONTINUE WITH GOOGLE
            </button>
          </form>
        )}

        {/* 3. Admin Login Form */}
        {role === 'admin' && (
          <form className="login-form active" onSubmit={handleAdminLogin}>
            <div className="form-group">
              <label htmlFor="admin-user">Admin Username</label>
              <input
                type="text"
                id="admin-user"
                placeholder="admin_user"
                required
                value={adminUser}
                onChange={(e) => setAdminUser(e.target.value)}
              />
            </div>
            <div className="form-group">
              <label htmlFor="admin-pass">Password</label>
              <input type="password" id="admin-pass" placeholder="••••••••" required />
            </div>
            <div className="form-group">
              <label htmlFor="admin-key">Security Key / 2FA Code</label>
              <input type="text" id="admin-key" placeholder="6-digit code" required />
            </div>
            <button
              type="submit"
              className="submit-btn"
              disabled={isLoggingIn}
            >
              <span className="pacman-icon"></span> LOGIN
            </button>

            <div className="oauth-divider">
              <span>OR SINGLE SIGN-ON</span>
            </div>

            <button
              type="button"
              className="google-oauth-btn"
              onClick={handleGoogleOAuth}
              disabled={isLoggingIn}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" fill="#FBBC05"/>
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" fill="#EA4335"/>
              </svg>
              CONTINUE WITH GOOGLE
            </button>
          </form>
        )}

        <div className="arcade-footer">
          <span>INSERT COIN (1 CREDIT)</span>
          <span>LEVEL 3.0</span>
        </div>
      </div>
    </>
  );
}
