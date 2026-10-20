import { supabase, MEDIA_BUCKET } from "./supabase";

export function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

// Uploads to Supabase Storage and returns the public URL; falls back to a
// data URL when Supabase isn't configured.
export async function fileToUrl(file) {
  if (!supabase) return fileToDataUrl(file);
  const ext = file.name?.split(".").pop() || "bin";
  const path = `${new Date().toISOString().slice(0, 10)}/${crypto.randomUUID()}.${ext}`;
  const { error } = await supabase.storage
    .from(MEDIA_BUCKET)
    .upload(path, file, { contentType: file.type, upsert: false });
  if (error) throw error;
  return supabase.storage.from(MEDIA_BUCKET).getPublicUrl(path).data.publicUrl;
}
