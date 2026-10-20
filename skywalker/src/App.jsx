import { BrowserRouter as Router, Navigate, Route, Routes, useLocation } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import { ThemeProvider } from "./lib/theme";
import TopNav from "./components/TopNav/TopNav";
import Landing from "./pages/Landing/Landing";
import Gallery from "./pages/Gallery/Gallery";
import MyBlog from "./pages/MyBlog/MyBlog";
import BlogDetail from "./pages/BlogDetail/BlogDetail";
import BlogEditor from "./pages/BlogEditor/BlogEditor";
import MapsPage from "./pages/MapsPage";
import Account from "./pages/Account/Account";
import Drafts from "./pages/Drafts/Drafts";
import { AuthProvider, RequireAuth } from "./lib/auth";
import { GlobePrefsProvider } from "./lib/globePrefs";
import { TourProvider } from "./lib/tour";
import Tour from "./components/Tour/Tour";
import { GLOBE_PATH } from "./utils/routes";

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
  const isEditorRoute = HIDE_GLOBAL_NAV_PREFIXES.some((p) => location.pathname.startsWith(p));
  const showGlobalNav = !isEditorRoute;
  // Keying by pathname alone remounted the editor (fade out/in, refetch, lost
  // keystrokes) when "Save as Draft" swapped /blogs/new for /blogs/edit/:id.
  const transitionKey = isEditorRoute ? "editor" : location.pathname;

  return (
    <>
      {showGlobalNav && <TopNav />}
      {/* Isolated stacking context: page layers stay under the nav; dialogs
          that must cover it portal to <body> (see --z-* in index.css). */}
      <main className="app-main">
        <AnimatePresence mode="wait">
          <Routes location={location} key={transitionKey}>
            <Route path="/" element={<PageTransition><Landing /></PageTransition>} />
            <Route path="/gallery" element={<PageTransition><Gallery /></PageTransition>} />
            <Route path="/blogs" element={<PageTransition><MyBlog /></PageTransition>} />
            <Route path="/blogs/drafts" element={<RequireAuth><PageTransition><Drafts /></PageTransition></RequireAuth>} />
            <Route path="/blogs/new" element={<RequireAuth><PageTransition><BlogEditor /></PageTransition></RequireAuth>} />
            <Route path="/blogs/edit/:id" element={<RequireAuth><PageTransition><BlogEditor /></PageTransition></RequireAuth>} />
            <Route path="/blogs/:id" element={<PageTransition><BlogDetail /></PageTransition>} />
            <Route path={GLOBE_PATH} element={<PageTransition><MapsPage /></PageTransition>} />
            <Route path="/maps" element={<Navigate to={GLOBE_PATH} replace />} />
            <Route path="/account" element={<PageTransition><Account /></PageTransition>} />
          </Routes>
        </AnimatePresence>
      </main>
      <Tour />
    </>
  );
}

const App = () => {
  return (
    <ThemeProvider>
      <AuthProvider>
        <GlobePrefsProvider>
          <Router>
            <TourProvider>
              <AppShell />
            </TourProvider>
          </Router>
        </GlobePrefsProvider>
      </AuthProvider>
    </ThemeProvider>
  );
};

export default App;
