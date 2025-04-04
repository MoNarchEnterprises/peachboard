import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Auth } from '@supabase/auth-ui-react';
import { ThemeSupa } from '@supabase/auth-ui-shared';
import { supabase } from '../lib/supabaseClient';

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
      <h1 style={{ textAlign: 'center', marginBottom: '30px', color: '#333' }}>PeachBoard</h1>
      <Auth
        supabaseClient={supabase}
        appearance={{
          theme: ThemeSupa, // Base theme
          variables: {
            default: {
              colors: {
                brand: '#98FB98', // Light Green for primary buttons
                brandAccent: '#76c876', // Darker green for hover
                brandButtonText: 'black', // Black text on light green button
                defaultButtonBackground: '#FFE5B4', // Peach for secondary elements (e.g., links)
                defaultButtonBackgroundHover: '#ffdab0', // Darker peach hover
                inputBackground: '#fff', // White input background
                inputBorder: '#FFE5B4', // Peach border for inputs
                inputBorderHover: '#ffdab0', // Darker peach border on hover
                inputBorderFocus: '#98FB98', // Light green border on focus
                inputText: '#333',
                inputLabelText: '#555',
                messageText: '#8B8000', // Dark Yellow for messages
                messageBackground: '#FAFAD2', // LightGoldenrodYellow background for messages
                messageBorder: '#E6E6AA', // Slightly darker yellow border
                anchorTextColor: '#D2691E', // Using a brown/peach tone for links
                anchorTextHoverColor: '#A0522D', // Darker brown/peach on hover
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
        onlyThirdPartyProviders={true} // Explicitly disable all social providers
      />
    </div>
  );
};

export default LoginPage;