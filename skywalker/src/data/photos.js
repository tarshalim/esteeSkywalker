// Thin re-export so existing import sites (Gallery.jsx, GlobeExplorer.jsx, etc.)
// never had to change when the datasets were consolidated into mockData.js.
export { mockPhotos, visitedCountryCodes, fetchPhotos } from "./mockData";
