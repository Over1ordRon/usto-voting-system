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
    // load stored user
    const saved = localStorage.getItem("user");
    if (saved) {
      const data = JSON.parse(saved);
      setUser(data);
      setIsAdmin(adminEmails.includes(data.email));
    }

    // load google script
    const timer = setInterval(() => {
      if (window.google && window.google.accounts) {
        initGoogle();
        clearInterval(timer);
      }
    }, 300);
  }, []);

  const initGoogle = () => {
    window.google.accounts.id.initialize({
      client_id: GOOGLE_CLIENT_ID,
      callback: handleGoogleResponse,
    });
  };

  const handleGoogleResponse = (res) => {
    const payload = JSON.parse(atob(res.credential.split(".")[1]));

    if (!payload.email.endsWith(ALLOWED_DOMAIN)) {
      alert(`Only ${ALLOWED_DOMAIN} emails allowed`);
      return;
    }

    const data = {
      email: payload.email,
      name: payload.name || payload.email,
      picture: payload.picture,
      sub: payload.sub,
    };

    localStorage.setItem("user", JSON.stringify(data));
    setUser(data);
    setIsAdmin(adminEmails.includes(data.email));
  };

  const signOut = () => {
    localStorage.removeItem("user");
    setUser(null);
    setIsAdmin(false);
  };

  return { user, isAdmin, signOut };
}
