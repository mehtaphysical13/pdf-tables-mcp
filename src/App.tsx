import { useEffect, useState } from "react";
import Landing from "./pages/Landing";
import Dashboard from "./pages/Dashboard";
import Blog from "./pages/Blog";

type Route =
  | { name: "landing" }
  | { name: "dashboard"; apiKey: string | null }
  | { name: "blog" };

function parseRoute(): Route {
  const p = window.location.pathname;
  if (p.startsWith("/dashboard")) {
    const hash = window.location.hash;
    const apiKey = hash.startsWith("#") ? hash.slice(1) : null;
    return { name: "dashboard", apiKey };
  }
  if (p.startsWith("/blog")) {
    return { name: "blog" };
  }
  return { name: "landing" };
}

export default function App() {
  const [route, setRoute] = useState<Route>(() => parseRoute());

  useEffect(() => {
    const onChange = () => setRoute(parseRoute());
    window.addEventListener("hashchange", onChange);
    window.addEventListener("popstate", onChange);
    return () => {
      window.removeEventListener("hashchange", onChange);
      window.removeEventListener("popstate", onChange);
    };
  }, []);

  if (route.name === "dashboard") {
    return <Dashboard initialApiKey={route.apiKey} />;
  }
  if (route.name === "blog") {
    return <Blog />;
  }
  return <Landing />;
}
