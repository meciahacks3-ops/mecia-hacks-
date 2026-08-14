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
  const [projectType, setProjectType] = useState('hardware');
  const [judgeEmail, setJudgeEmail] = useState('');
  const [adminUser, setAdminUser] = useState('');
  const [adminPass, setAdminPass] = useState('');
  const [adminKey, setAdminKey] = useState('');
  const [activeAdminKey, setActiveAdminKey] = useState('');
  const [keyNotice, setKeyNotice] = useState('');
  const [authError, setAuthError] = useState('');

  const COMMON_ADMIN_PASS = 'MeciaHacks2026!';

  const ALLOWED_ADMIN_EMAILS = {
    '24ce58@svitvasad.ac.in': { name: 'Manav Patel', pass: COMMON_ADMIN_PASS },
    '24ce67@svitvasad.ac.in': { name: 'Het Patel', pass: COMMON_ADMIN_PASS },
    'devpatel4536@gmail.com': { name: 'Dev Patel', pass: COMMON_ADMIN_PASS },
    '224csd8@svitvasad.ac.in': { name: 'Tej Patel', pass: COMMON_ADMIN_PASS },
    'milinpatel.comp@svitvasad.ac.in': { name: 'Milin Patel', pass: COMMON_ADMIN_PASS }
  };

  const recordLoginToSupabase = async (email, roleDescription) => {
    if (!email) return;
    const cleanEmail = email.trim().toLowerCase();
    const loginTimestamp = new Date().toLocaleString();
    try {
      const { data: existing } = await supabase
        .from('allowed_users')
        .select('id, email')
        .ilike('email', cleanEmail)
        .maybeSingle();

      if (existing && existing.id) {
        await supabase
          .from('allowed_users')
          .update({ added_by: `${roleDescription} | Last Active: ${loginTimestamp}` })
          .eq('id', existing.id);
      } else {
        await supabase
          .from('allowed_users')
          .insert([{
            email: cleanEmail,
            added_by: `${roleDescription} | First Login: ${loginTimestamp}`
          }]);
      }
    } catch (err) {
      console.warn("Supabase login tracking warning:", err);
    }
  };

  const isGmailWhitelisted = async (email) => {
    if (!email) return false;
    try {
      const { count } = await supabase.from('allowed_users').select('*', { count: 'exact', head: true });
      if (count === 0 || count === null) return true; // If whitelist table is empty/not populated yet, allow

      const { data } = await supabase
        .from('allowed_users')
        .select('email')
        .ilike('email', email)
        .maybeSingle();

      return Boolean(data);
    } catch (e) {
      return true;
    }
  };

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
        const targetRole = sessionStorage.getItem('targetRole') || 'student';

        // Student login is OPEN to every Google account! Whitelist check only applies for non-student roles.
        if (targetRole !== 'student') {
          const allowed = await isGmailWhitelisted(userEmail);
          if (!allowed) {
            await supabase.auth.signOut();
            sessionStorage.clear();
            setAuthError(`⛔ ACCESS DENIED: Your email (${userEmail}) is not authorized for this portal.`);
            return;
          }
        }
        
        await recordLoginToSupabase(userEmail, `${targetRole.toUpperCase()} (Google OAuth)`);

        if (targetRole === 'judge') {
          sessionStorage.setItem('judgeEmail', userEmail);
          router.push('/judge-dashboard');
        } else if (targetRole === 'admin') {
          sessionStorage.setItem('adminUser', userEmail);
          router.push('/admin-dashboard');
        } else {
          sessionStorage.setItem('studentId', userEmail);
          router.push('/project-submission');
        }
      }
    };
    checkOAuthSession();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (session?.user) {
        const userEmail = session.user.email || session.user.user_metadata?.email;
        const targetRole = sessionStorage.getItem('targetRole') || 'student';

        // Student login is OPEN to every Google account!
        if (targetRole !== 'student') {
          const allowed = await isGmailWhitelisted(userEmail);
          if (!allowed) {
            await supabase.auth.signOut();
            sessionStorage.clear();
            setAuthError(`⛔ ACCESS DENIED: Your email (${userEmail}) is not authorized.`);
            return;
          }
        }
        
        await recordLoginToSupabase(userEmail, `${targetRole.toUpperCase()} (Google OAuth)`);

        if (targetRole === 'judge') {
          sessionStorage.setItem('judgeEmail', userEmail);
          router.push('/judge-dashboard');
        } else if (targetRole === 'admin') {
          sessionStorage.setItem('adminUser', userEmail);
          router.push('/admin-dashboard');
        } else {
          sessionStorage.setItem('studentId', userEmail);
          router.push('/project-submission');
        }
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

  const handleRoleSelect = (selectedRole) => {
    setRole(selectedRole);
    sessionStorage.setItem('targetRole', selectedRole);
  };

  const handleGoogleOAuth = async () => {
    setIsLoggingIn(true);
    sessionStorage.setItem('targetRole', role);
    try {
      const originUrl = typeof window !== 'undefined' ? window.location.origin : 'https://mecia-hacks.vercel.app';
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: originUrl,
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
    sessionStorage.setItem('targetRole', 'student');
    sessionStorage.setItem('projectType', projectType);
    if (studentId) {
      sessionStorage.setItem('studentId', studentId);
      await recordLoginToSupabase(studentId, `STUDENT Direct`);
    }
    setTimeout(() => {
      setIsLoggingIn(false);
      router.push('/project-submission');
    }, 400);
  };

  const handleJudgeLogin = async (e) => {
    e.preventDefault();
    setIsLoggingIn(true);
    sessionStorage.setItem('targetRole', 'judge');
    const email = judgeEmail || 'judge@eval.org';
    sessionStorage.setItem('judgeEmail', email);
    await recordLoginToSupabase(email, `JUDGE Panel`);
    setTimeout(() => {
      setIsLoggingIn(false);
      router.push('/judge-dashboard');
    }, 400);
  };

  const handleAdminLogin = async (e) => {
    e.preventDefault();
    setAuthError('');
    setIsLoggingIn(true);
    sessionStorage.setItem('targetRole', 'admin');

    const cleanUser = (adminUser || '').trim().toLowerCase();
    const adminAccount = ALLOWED_ADMIN_EMAILS[cleanUser];

    if (!adminAccount) {
      setIsLoggingIn(false);
      setAuthError(`⛔ ACCESS DENIED: '${cleanUser}' is not an authorized Admin Email ID. Access is strictly limited to the 5 official Admin team accounts.`);
      return;
    }

    const enteredPass = adminPass.trim();
    const isPassValid = enteredPass === COMMON_ADMIN_PASS || enteredPass.toLowerCase() === 'meciahacks2026' || enteredPass === 'MeciaHacks2026';

    if (!isPassValid) {
      setIsLoggingIn(false);
      setAuthError('⛔ ACCESS DENIED: Incorrect Admin Password.');
      return;
    }

    sessionStorage.setItem('adminUser', cleanUser);
    sessionStorage.setItem('adminRoleName', adminAccount.name);
    await recordLoginToSupabase(cleanUser, `ADMIN (${adminAccount.name})`);

    setTimeout(() => {
      setIsLoggingIn(false);
      router.push('/admin-dashboard');
    }, 400);
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

        {/* Auth Error Banner */}
        {authError && (
          <div style={{
            background: 'rgba(255, 0, 85, 0.15)',
            border: '2px solid #ff0055',
            color: '#ff4d79',
            padding: '12px 14px',
            borderRadius: '8px',
            fontFamily: 'Press Start 2P, monospace',
            fontSize: '0.62rem',
            lineHeight: '1.5',
            marginBottom: '16px',
            textAlign: 'center'
          }}>
            {authError}
          </div>
        )}

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
            onClick={() => handleRoleSelect('student')}
          >
            <span className="tab-ghost red-ghost"></span> Student
          </button>
          <button
            type="button"
            className={`tab-btn judge-tab ${role === 'judge' ? 'active' : ''}`}
            onClick={() => handleRoleSelect('judge')}
          >
            <span className="tab-ghost cyan-ghost"></span> Judge
          </button>
          <button
            type="button"
            className={`tab-btn admin-tab ${role === 'admin' ? 'active' : ''}`}
            onClick={() => handleRoleSelect('admin')}
          >
            <span className="tab-ghost pink-ghost"></span> Admin
          </button>
        </div>

        {/* 1. Student Login Form (Strictly Google Account Only) */}
        {role === 'student' && (
          <div className="login-form active">
            <div style={{
              background: 'rgba(33, 33, 255, 0.12)',
              border: '1px dashed rgba(33, 33, 255, 0.6)',
              padding: '12px 14px',
              borderRadius: '8px',
              color: '#a0a0dd',
              fontSize: '0.68rem',
              fontFamily: 'Press Start 2P, monospace',
              lineHeight: '1.6',
              marginBottom: '20px',
              textAlign: 'center'
            }}>
              🔒 STUDENT ACCESS: STRICTLY GOOGLE ACCOUNT AUTHENTICATION ONLY
            </div>

            <button
              type="button"
              className="google-oauth-btn"
              onClick={handleGoogleOAuth}
              disabled={isLoggingIn}
              style={{
                width: '100%',
                padding: '14px 16px',
                fontSize: '0.78rem',
                justifyContent: 'center'
              }}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" fill="#FBBC05"/>
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" fill="#EA4335"/>
              </svg>
              CONTINUE WITH GOOGLE ACCOUNT
            </button>
          </div>
        )}

        {/* 2. Judge Login Form */}
        {role === 'judge' && (
          <form className="login-form active" onSubmit={handleJudgeLogin}>
            <div className="form-group">
              <label htmlFor="judge-email">Judge Email</label>
              <input
                type="email"
                id="judge-email"
                placeholder="Enter Judge Email"
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
              <label htmlFor="admin-user">Admin Email ID</label>
              <input
                type="email"
                id="admin-user"
                placeholder="Enter Admin Email ID"
                required
                value={adminUser}
                onChange={(e) => setAdminUser(e.target.value)}
              />
            </div>
            <div className="form-group">
              <label htmlFor="admin-pass">Password</label>
              <input
                type="password"
                id="admin-pass"
                placeholder="••••••••"
                required
                value={adminPass}
                onChange={(e) => setAdminPass(e.target.value)}
              />
            </div>
            <button
              type="submit"
              className="submit-btn"
              disabled={isLoggingIn}
            >
              <span className="pacman-icon"></span> LOGIN TO ADMIN PORTAL
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
