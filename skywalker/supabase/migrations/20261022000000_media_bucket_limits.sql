-- Cap single uploads to the `media` bucket at 50 MB — the project's global
-- upload limit on the Free plan, and MAX_UPLOAD_BYTES in src/lib/files.js.
-- Raise all three together (dashboard → Storage → Settings) on a paid plan.
--
-- allowed_mime_types stays null on purpose: the bucket also holds images and
-- canvas audio, and some pickers hand over files with no MIME type (HEIC on
-- Windows), which a whitelist would reject. Videos are checked client-side
-- against VIDEO_MIME_TYPES before upload.
--
-- CORS needs no setup: Storage answers preflights for any origin, and the
-- existing policies already give public read + admin upload.
update storage.buckets
set public = true,
    file_size_limit = 52428800 -- 50 MB
where id = 'media';
