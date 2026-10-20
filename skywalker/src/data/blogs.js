// Thin re-export so existing import sites (blogStore.js, etc.) never had to
// change when the datasets were consolidated into mockData.js.
export { mockBlogs } from "./mockData";

import { mockBlogs } from "./mockData";

export const journeyWaypointOptions = mockBlogs.map((b) => ({
  id: b.id,
  label: b.location.name,
}));
