import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import logo from '../assets/logoonly.png'; // Import the logo
import { FaEye, FaEyeSlash } from 'react-icons/fa'; // Import icons

// Basic styles (can be moved to styled-components or CSS modules later)
const styles: Record<string, React.CSSProperties> = { // Add explicit type
  container: {
    maxWidth: '480px',
    margin: '60px auto',
    padding: '40px',
    border: '1px solid #eee',
    borderRadius: '12px',
    boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
    background: '#fff',
    color: '#333', // Ensure text is visible on white background
  },
  titleContainer: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: '30px',
    gap: '10px',
  },
  logo: {
    height: '40px',
    width: 'auto',
  },
  title: {
    margin: 0,
    color: '#333',
  },
  form: {
    display: 'flex',
    flexDirection: 'column',
    gap: '15px',
  },
  inputGroup: {
    position: 'relative', // Needed for absolute positioning of the icon
    display: 'flex',
    flexDirection: 'column',
    gap: '5px',
  },
  label: {
    fontSize: '14px',
    color: '#555',
    fontWeight: '500',
  },
  input: {
    padding: '12px 14px',
    border: '1px solid #FFDAB9', // Peach border
    borderRadius: '8px',
    fontSize: '14px',
    fontFamily: `system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, 'Open Sans', 'Helvetica Neue', sans-serif`,
  },
  passwordInputContainer: {
    position: 'relative', // Container for input + icon
    display: 'flex',
    alignItems: 'center',
  },
  passwordInput: {
    flexGrow: 1,
    paddingRight: '40px', // Make space for the icon
    padding: '12px 14px',
    border: '1px solid #FFDAB9', // Peach border
    borderRadius: '8px',
    fontSize: '14px',
    fontFamily: `system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, 'Open Sans', 'Helvetica Neue', sans-serif`,
  },
  toggleButton: {
    position: 'absolute',
    right: '10px',
    top: '50%',
    transform: 'translateY(-50%)',
    background: 'none',
    border: 'none',
    padding: '5px',
    cursor: 'pointer',
    color: '#555',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  button: {
    padding: '12px 18px',
    border: 'none',
    borderRadius: '8px',
    backgroundColor: '#FFDAB9', // Peach background
    color: '#444', // Darker text
    fontSize: '14px',
    fontWeight: '500',
    cursor: 'pointer',
    transition: 'background-color 0.2s',
    marginTop: '10px',
  },
  buttonHover: { // Simulate hover for inline styles if needed
    backgroundColor: '#FFA07A', // Darker Peach/Light Salmon
  },
  link: {
    color: '#D2691E', // Chocolate/Brown tone
    textDecoration: 'underline',
    cursor: 'pointer',
    fontSize: '13px',
    textAlign: 'center',
    marginTop: '10px',
  },
  error: {
    color: 'red',
    fontSize: '13px',
    textAlign: 'center',
    marginTop: '10px',
  },
  message: {
    color: '#8B4513', // SaddleBrown
    backgroundColor: '#FFF8DC', // Cornsilk
    border: '1px solid #FAEBD7', // AntiqueWhite
    padding: '10px',
    borderRadius: '8px',
    fontSize: '13px',
    textAlign: 'center',
    marginTop: '10px',
  },
  toggleMode: {
    marginTop: '20px',
    textAlign: 'center',
    fontSize: '13px',
  }
};

const LoginPage: React.FC = () => {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState(''); // State for confirm password
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false); // State for confirm password visibility
  const [isSignUp, setIsSignUp] = useState(false); // Toggle between Login and Sign Up

  // Existing session check logic
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        navigate('/dashboard');
      }
    });

    const { data: authListener } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        if (session) {
          navigate('/dashboard');
        }
        // No need to navigate back to /login on sign out, user might be navigating elsewhere
      }
    );

    return () => {
      authListener?.subscription.unsubscribe();
    };
  }, [navigate]);

  const handleAuthAction = async (event: React.FormEvent) => {
    event.preventDefault();
    setLoading(true);
    setError(null);
    setMessage(null); // Also clear message on new action

    // Check if passwords match before proceeding with signup
    if (isSignUp && password !== confirmPassword) {
      setError("Passwords do not match.");
      setLoading(false);
      return;
    }

    try {
      let response;
      if (isSignUp) {
        // Sign Up
        response = await supabase.auth.signUp({ email, password });
        if (response.error) throw response.error;
        // Check if user object exists and email confirmation is needed
        if (response.data.user && response.data.user.identities?.length === 0) {
           setMessage('Signup successful, but there might be an issue. Please contact support.'); // Or handle specific cases
        } else if (response.data.session === null) {
           setMessage('Signup successful! Please check your email to verify your account.');
        } else {
           // If session exists immediately (e.g., email auth disabled), redirect
           // navigate('/dashboard'); // This is handled by onAuthStateChange listener
           setMessage('Signup successful!'); // Or just let the listener handle redirect
        }

      } else {
        // Sign In
        response = await supabase.auth.signInWithPassword({ email, password });
        if (response.error) throw response.error;
        // Redirect is handled by the onAuthStateChange listener
      }
    } catch (error: any) {
      console.error("Auth Error:", error);
      setError(error.error_description || error.message || 'An unknown error occurred.');
    } finally {
      setLoading(false);
    }
  };

  const handlePasswordReset = async () => {
     if (!email) {
       setError('Please enter your email address first to reset the password.');
       return;
     }
     setLoading(true);
     setError(null);
     setMessage(null);
     try {
       const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
         redirectTo: window.location.origin + '/update-password', // URL user is redirected to after clicking link
       });
       if (resetError) throw resetError;
       setMessage('Password reset email sent! Please check your inbox.');
     } catch (error: any) {
       console.error("Password Reset Error:", error);
       setError(error.error_description || error.message || 'Failed to send password reset email.');
     } finally {
       setLoading(false);
     }
   };

  return (
    <div style={styles.container}>
      <div style={styles.titleContainer}>
        <img src={logo} alt="PeachBoard Logo" style={styles.logo} />
        <h1 style={styles.title}>PeachBoard</h1>
      </div>

      <form onSubmit={handleAuthAction} style={styles.form}>
        <div style={styles.inputGroup}>
          <label htmlFor="email" style={styles.label}>Email address</label>
          <input
            id="email"
            type="email"
            placeholder="Your email address"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            style={styles.input}
          />
        </div>

        <div style={styles.inputGroup}>
          <label htmlFor="password" style={styles.label}>
            {isSignUp ? 'Create a Password' : 'Your Password'}
          </label>
          <div style={styles.passwordInputContainer}>
            <input
              id="password"
              type={showPassword ? 'text' : 'password'}
              placeholder="Your password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              style={styles.passwordInput}
              autoComplete={isSignUp ? "new-password" : "current-password"}
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              style={styles.toggleButton}
              aria-label={showPassword ? 'Hide password' : 'Show password'}
            >
              {showPassword ? <FaEyeSlash size={16} /> : <FaEye size={16} />}
            </button>
          </div>
        </div>

        {/* Conditionally render Confirm Password field for Sign Up */}
        {isSignUp && (
          <div style={styles.inputGroup}>
            <label htmlFor="confirmPassword" style={styles.label}>Confirm Password</label>
            {/* Wrap confirm password input for toggle */}
            <div style={styles.passwordInputContainer}>
              <input
                id="confirmPassword"
                type={showConfirmPassword ? 'text' : 'password'} // Use new state
                placeholder="Confirm your password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                style={styles.passwordInput} // Use passwordInput style for padding
                autoComplete="new-password"
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)} // Use new state setter
                style={styles.toggleButton}
                aria-label={showConfirmPassword ? 'Hide confirm password' : 'Show confirm password'}
              >
                {showConfirmPassword ? <FaEyeSlash size={16} /> : <FaEye size={16} />}
              </button>
            </div>
            {/* Password match indicator */}
            {password && confirmPassword && (
              <p style={{
                 fontSize: '12px',
                 marginTop: '4px',
                 // Use explicit CSSProperties type here too for safety
                 color: password === confirmPassword ? 'green' : 'red'
               } as React.CSSProperties}>
                {password === confirmPassword ? 'Passwords match' : 'Passwords do not match'}
              </p>
            )}
          </div>
        )}

        {error && <p style={styles.error}>{error}</p>}
        {message && <p style={styles.message}>{message}</p>}

        <button type="submit" disabled={loading} style={styles.button}>
          {loading ? 'Processing...' : (isSignUp ? 'Sign Up' : 'Sign In')}
        </button>

        {!isSignUp && (
           <a onClick={handlePasswordReset} style={styles.link} role="button">
             Forgot your password?
           </a>
         )}
      </form>

       <div style={styles.toggleMode}>
         {isSignUp ? (
           <>
             Already have an account?{' '}
             <a onClick={() => setIsSignUp(false)} style={styles.link} role="button">
               Sign In
             </a>
           </>
         ) : (
           <>
             Don't have an account?{' '}
             <a onClick={() => setIsSignUp(true)} style={styles.link} role="button">
               Sign Up
             </a>
           </>
         )}
       </div>
    </div>
  );
};

export default LoginPage;