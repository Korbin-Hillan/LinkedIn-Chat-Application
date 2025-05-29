import React from 'react';

const LinkedInLogin = () => {
    const CLIENT_ID = process.env.REACT_APP_LINKEDIN_CLIENT_ID;
    const REDIRECT_URI = process.env.REACT_APP_REDIRECT_URI;  
    const STATE  = Math.random().toString(36).substring(7);

const handleLogin = () => {
  const CLIENT_ID    = process.env.REACT_APP_LINKEDIN_CLIENT_ID;
  const REDIRECT_URI = process.env.REACT_APP_REDIRECT_URI;
  const STATE        = Math.random().toString(36).substring(7);

  sessionStorage.setItem('linkedin_oauth_state', STATE);

  const SCOPE = "openid profile email";  //

  const authUrl =
    "https://www.linkedin.com/oauth/v2/authorization" +
    `?response_type=code` +
    `&client_id=${CLIENT_ID}` +
    `&redirect_uri=${encodeURIComponent(REDIRECT_URI)}` +
    `&scope=${encodeURIComponent(SCOPE)}` +  // This MUST be URL encoded
    `&state=${STATE}`;

  window.location.href = authUrl;
};

  return (
    <div style={{ textAlign: 'center', marginTop: '3rem' }}>
      <h1>LinkedIn Chat</h1>
      <button onClick={handleLogin}>
        Sign in with LinkedIn
      </button>
    </div>
  );
};

export default LinkedInLogin;