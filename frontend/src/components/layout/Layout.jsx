import { Outlet, useLocation } from "react-router-dom";
import { Navbar } from "./Navbar";
import { Footer } from "./Footer";

export function Layout() {
  const { pathname } = useLocation();
  const isChat = pathname === "/chat";

  return (
    <div className={isChat ? "chat-layout flex min-h-screen flex-col" : "flex min-h-screen flex-col"}>
      <a className="shop-skip" href="#main-content">Skip to content</a>
      <Navbar />
      <main id="main-content" className="flex flex-1 flex-col" tabIndex={-1}>
        <Outlet />
      </main>
      {!isChat && <Footer />}
    </div>
  );
}
