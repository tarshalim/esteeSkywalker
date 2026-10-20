import { BrowserRouter as Router, Route, Routes, useLocation } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import { ThemeProvider } from "./lib/theme";
import TopNav from "./components/TopNav/TopNav";
import Landing from "./pages/Landing/Landing";
import Gallery from "./pages/Gallery/Gallery";
import BlogsJourney from "./pages/BlogsJourney/BlogsJourney";
import BlogDetail from "./pages/BlogDetail/BlogDetail";
import BlogEditor from "./pages/BlogEditor/BlogEditor";
import MapsPage from "./pages/MapsPage";
import Account from "./pages/Account/Account";
import { AuthProvider, RequireAuth } from "./lib/auth";

// The editor gets its own dedicated header (title/cover/save actions), so the
// floating global nav would just compete with it for the same screen space.
const HIDE_GLOBAL_NAV_PREFIXES = ["/blogs/new", "/blogs/edit"];

function PageTransition({ children }) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.35, ease: "easeOut" }}
    >
      {children}
    </motion.div>
  );
}

function AppShell() {
  const location = useLocation();
  const showGlobalNav = !HIDE_GLOBAL_NAV_PREFIXES.some((p) => location.pathname.startsWith(p));

  return (
    <>
      {showGlobalNav && <TopNav />}
      <AnimatePresence mode="wait">
        <Routes location={location} key={location.pathname}>
          <Route path="/" element={<PageTransition><Landing /></PageTransition>} />
          <Route path="/gallery" element={<PageTransition><Gallery /></PageTransition>} />
          <Route path="/blogs" element={<PageTransition><BlogsJourney /></PageTransition>} />
          <Route path="/blogs/new" element={<RequireAuth><PageTransition><BlogEditor /></PageTransition></RequireAuth>} />
          <Route path="/blogs/edit/:id" element={<RequireAuth><PageTransition><BlogEditor /></PageTransition></RequireAuth>} />
          <Route path="/blogs/:id" element={<PageTransition><BlogDetail /></PageTransition>} />
          <Route path="/maps" element={<PageTransition><MapsPage /></PageTransition>} />
          <Route path="/account" element={<PageTransition><Account /></PageTransition>} />
        </Routes>
      </AnimatePresence>
    </>
  );
}

const App = () => {
  return (
    <ThemeProvider>
      <AuthProvider>
        <Router>
          <AppShell />
        </Router>
      </AuthProvider>
    </ThemeProvider>
  );
};

export default App;
