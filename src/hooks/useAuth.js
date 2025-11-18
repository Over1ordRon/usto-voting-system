import { useEffect, useState } from "react";

const ALLOWED_DOMAIN = "@etu.univ-usto.dz";
const GOOGLE_CLIENT_ID = "337975458118-unpg0jnt0jq24h3mlumclknm5dbp09pg.apps.googleusercontent.com";

const adminEmails = [
  "232335230820@etu.univ-usto.dz",
  "232337393613@etu.univ-usto.dz"
];

export function useAuth() {
  const [user, setUser] = useState(null);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    // Load stored user from sessionStorage (more secure than localStorage)
    const saved = sessionStorage.getItem("user");
    if (saved) {
      try {
        const data = JSON.parse(saved);
        setUser(data);
        setIsAdmin(adminEmails.includes(data.email));
      } catch (error) {
        console.error("Failed to parse stored user:", error);
        sessionStorage.removeItem("user");
      }
    }

    // Load Google Sign-In script
    const timer = setInterval(() => {
      if (window.google && window.google.accounts) {
        initGoogle();
        clearInterval(timer);
      }
    }, 300);

    return () => clearInterval(timer);
  }, []);

  const handleGoogleResponse = (res) => {
    try {
      const payload = JSON.parse(atob(res.credential.split(".")[1]));

      if (!payload.email.endsWith(ALLOWED_DOMAIN)) {
        alert(`Only ${ALLOWED_DOMAIN} emails are allowed`);
        return;
      }

      const data = {
        email: payload.email,
        name: payload.name || payload.email,
        picture: payload.picture,
        sub: payload.sub,
      };

      sessionStorage.setItem("user", JSON.stringify(data));
      setUser(data);
      setIsAdmin(adminEmails.includes(data.email));
    } catch (error) {
      console.error("Failed to handle Google response:", error);
      alert("Failed to sign in. Please try again.");
    }
  };

  const initGoogle = () => {
    // Expose callback globally for Google button
    window.handleCredentialResponse = handleGoogleResponse;

    window.google.accounts.id.initialize({
      client_id: GOOGLE_CLIENT_ID,
      callback: handleGoogleResponse,
    });

    // Render the button if the container exists
    const buttonDiv = document.getElementById('g_id_signin');
    if (buttonDiv) {
      window.google.accounts.id.renderButton(
        buttonDiv,
        { 
          theme: "outline", 
          size: "large",
          text: "signin_with",
          shape: "rectangular"
        }
      );
    }
  };

  const signOut = () => {
    sessionStorage.removeItem("user");
    setUser(null);
    setIsAdmin(false);
    
    // Sign out from Google
    if (window.google && window.google.accounts) {
      window.google.accounts.id.disableAutoSelect();
    }
  };

  return { user, isAdmin, signOut };
}