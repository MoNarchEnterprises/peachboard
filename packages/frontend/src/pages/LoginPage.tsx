import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Auth } from '@supabase/auth-ui-react';
import { ThemeSupa } from '@supabase/auth-ui-shared';
import { supabase } from '../lib/supabaseClient';
import logo from '../assets/logoonly.png'; // Import the logo

const LoginPage: React.FC = () => {
  const navigate = useNavigate();

  useEffect(() => {
    // Redirect immediately if a session already exists
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        // TODO: Check user role (admin/tutor) before redirecting
        navigate('/dashboard');
      }
    });

    // Listen for authentication state changes (sign in, sign out)
    const { data: authListener } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        if (session) {
          // TODO: Check user role (admin/tutor) before redirecting
          navigate('/dashboard');
        } else {
          // Ensure user is on login page if signed out
          navigate('/login');
        }
      }
    );

    // Cleanup the listener when the component unmounts
    return () => {
      authListener?.subscription.unsubscribe();
    };
  }, [navigate]);

  return (
    // Container with modern styling - Corrected Syntax
    <div style={{
      maxWidth: '480px',
      margin: '60px auto',
      padding: '40px',
      border: '1px solid #eee',
      borderRadius: '12px',
      boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
      background: '#fff'
    }}>
      {/* Title container with logo */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '30px', gap: '10px' }}>
        <img src={logo} alt="PeachBoard Logo" style={{ height: '40px', width: 'auto' }} />
        <h1 style={{ margin: 0, color: '#333' }}>PeachBoard</h1>
      </div>
      <Auth
        supabaseClient={supabase}
        appearance={{
          theme: ThemeSupa, // Base theme
          variables: {
            default: {
              colors: {
                // Adjust colors to match logo aesthetics (assuming peach/orange/green)
                brand: '#FFDAB9', // Peach background for primary buttons
                brandAccent: '#FFA07A', // Darker Peach/Light Salmon for hover
                brandButtonText: '#444', // Darker text for better contrast on peach
                defaultButtonBackground: '#f8f8f8', // Lighter background for secondary elements
                defaultButtonBackgroundHover: '#e8e8e8',
                inputBackground: '#fff',
                inputBorder: '#FFDAB9', // Peach border
                inputBorderHover: '#FFA07A', // Darker Peach/Light Salmon on hover
                inputBorderFocus: '#FF8C69', // A slightly stronger orange/peach for focus
                inputText: '#333',
                inputLabelText: '#555',
                messageText: '#8B4513', // SaddleBrown for messages
                messageBackground: '#FFF8DC', // Cornsilk background for messages
                messageBorder: '#FAEBD7', // AntiqueWhite border
                anchorTextColor: '#D2691E', // Chocolate/Brown tone for links
                anchorTextHoverColor: '#A0522D', // Sienna/Darker Brown on hover
              },
              space: {
                spaceSmall: '4px',
                spaceMedium: '8px',
                spaceLarge: '16px',
                labelBottomMargin: '8px',
                anchorBottomMargin: '8px',
                emailInputSpacing: '8px',
                socialAuthSpacing: '16px',
                buttonPadding: '12px 18px',
                inputPadding: '12px 14px',
              },
              fontSizes: {
                baseBodySize: '14px',
                baseInputSize: '14px',
                baseLabelSize: '14px',
                baseButtonSize: '14px',
              },
              fonts: {
                bodyFontFamily: `system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, 'Open Sans', 'Helvetica Neue', sans-serif`,
                buttonFontFamily: `system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, 'Open Sans', 'Helvetica Neue', sans-serif`,
                inputFontFamily: `system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, 'Open Sans', 'Helvetica Neue', sans-serif`,
                labelFontFamily: `system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, 'Open Sans', 'Helvetica Neue', sans-serif`,
              },
              radii: {
                borderRadiusButton: '8px',
                buttonBorderRadius: '8px',
                inputBorderRadius: '8px',
              }
            },
          },
        }}
        providers={[]}
        
      />
    </div>
  );
};

export default LoginPage;