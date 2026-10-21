import { createContext, useContext, useRef } from "react";

const GlobeSessionContext = createContext(null);

/**
 * In-memory state shared by every GlobeExplorer mount — the homepage's
 * embedded globe (/#globe) and the navbar's dedicated page (/globe) — so
 * moving between them keeps the camera (rotation + zoom), the selection and
 * the already-loaded markers instead of starting over.
 *
 * Only one globe is mounted at a time and nothing needs to re-render when
 * this changes, so it's a plain mutable object, not React state:
 *   camera    {lat, lng, altitude} | null — last point of view
 *   selection {country, locationId, customPinId}
 *   data      {userId, photos, blogs, customPins, trips} | null — marker cache
 *             (shown on mount while the fresh fetch runs; ignored if it was
 *             loaded for a different user)
 */
export function GlobeSessionProvider({ children }) {
  const session = useRef({
    camera: null,
    selection: { country: null, locationId: null, customPinId: null },
    data: null,
  });
  return <GlobeSessionContext.Provider value={session.current}>{children}</GlobeSessionContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useGlobeSession() {
  const ctx = useContext(GlobeSessionContext);
  if (!ctx) throw new Error("useGlobeSession must be used within a GlobeSessionProvider");
  return ctx;
}
