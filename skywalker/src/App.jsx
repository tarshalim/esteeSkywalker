import { lazy, Suspense } from "react";
import { BrowserRouter as Router, matchPath, Navigate, Route, Routes, useLocation } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import { ThemeProvider } from "./lib/theme";
import TopNav from "./components/TopNav/TopNav";
import { AuthProvider, RequireAdmin, RequireAuth } from "./lib/auth";
import { GlobePrefsProvider } from "./lib/globePrefs";
import { GlobeSessionProvider } from "./lib/globeSession";
import { TourProvider } from "./lib/tour";
import { SearchProvider } from "./lib/search";
import Tour from "./components/Tour/Tour";
import FlashToast from "./components/FlashToast/FlashToast";
import ErrorBoundary from "./components/ErrorBoundary/ErrorBoundary";
import RouteError from "./components/RouteError/RouteError";
import { GLOBE_PATH } from "./lib/routes";

// The editor gets its own dedicated header (title/cover/save actions), so the
// floating global nav would just compete with it for the same screen space.
// Whole-segment patterns, not string prefixes: post ids are title slugs, so a
// reader URL like /blogs/new-zealand-trip must not count as the editor.
const EDITOR_ROUTES = ["/blogs/new", "/blogs/edit/:id"];

// Each page is its own chunk, so a route only downloads what it renders. The
// globe stack (three, react-globe.gl, three-globe, h3-js) is only pulled in by
// Landing, MapTab, Account and the editor; lottie only by the trail pages.
const Landing = lazy(() => import("./pages/Landing/Landing"));
const Gallery = lazy(() => import("./pages/Gallery/Gallery"));
const MyBlog = lazy(() => import("./pages/MyBlog/MyBlog"));
const BlogDetail = lazy(() => import("./pages/BlogDetail/BlogDetail"));
const BlogEditor = lazy(() => import("./pages/BlogEditor/BlogEditor"));
const MapTab = lazy(() => import("./pages/MapTab/MapTab"));
const TripDetail = lazy(() => import("./pages/TripDetail/TripDetail"));
const Account = lazy(() => import("./pages/Account/Account"));
const Drafts = lazy(() => import("./pages/Drafts/Drafts"));
const Settings = lazy(() => import("./pages/Settings/Settings"));
const NotFound = lazy(() => import("./pages/NotFound/NotFound"));

// Holds the page's space while its chunk loads so the layout doesn't jump.
function RouteFallback() {
  return (
    <div style={{ minHeight: "100vh" }} aria-busy="true">
      <span className="sr-only">Loading…</span>
    </div>
  );
}

function PageTransition({ children }) {
  const { pathname } = useLocation();
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.35, ease: "easeOut" }}
    >
      {/* Without this, a render crash or a failed chunk load on any page
          unmounted the whole app to a blank screen, navbar included.
          resetKey: the editor keeps one instance across /blogs/new →
          /blogs/edit/:id, so a path change has to clear the error. */}
      <ErrorBoundary resetKey={pathname} fallback={<RouteError />}>
        <Suspense fallback={<RouteFallback />}>{children}</Suspense>
      </ErrorBoundary>
    </motion.div>
  );
}

function AppShell() {
  const location = useLocation();
  const isEditorRoute = EDITOR_ROUTES.some((path) => matchPath(path, location.pathname));
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
            <Route path="/trips/:id" element={<PageTransition><TripDetail /></PageTransition>} />
            <Route path={GLOBE_PATH} element={<PageTransition><MapTab /></PageTransition>} />
            <Route path="/maps" element={<Navigate to={GLOBE_PATH} replace />} />
            <Route path="/account" element={<PageTransition><Account /></PageTransition>} />
            <Route
              path="/settings"
              element={<PageTransition><RequireAdmin fallback={<NotFound />}><Settings /></RequireAdmin></PageTransition>}
            />
            <Route path="*" element={<PageTransition><NotFound /></PageTransition>} />
          </Routes>
        </AnimatePresence>
      </main>
      <Tour />
      <FlashToast />
    </>
  );
}

const App = () => {
  return (
    <ThemeProvider>
      <AuthProvider>
        <GlobePrefsProvider>
          <GlobeSessionProvider>
            <Router>
              <TourProvider>
                <SearchProvider>
                  <AppShell />
                </SearchProvider>
              </TourProvider>
            </Router>
          </GlobeSessionProvider>
        </GlobePrefsProvider>
      </AuthProvider>
    </ThemeProvider>
  );
};

export default App;
