import * as ImagePicker from 'expo-image-picker';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import { sb } from '@/core/supabase';

const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
function base64ToBytes(b64: string): Uint8Array {
  const clean = b64.replace(/[^A-Za-z0-9+/]/g, '');
  const out = new Uint8Array(Math.floor((clean.length * 3) / 4));
  let o = 0;
  for (let i = 0; i < clean.length; i += 4) {
    const n = (B64.indexOf(clean[i]) << 18) | (B64.indexOf(clean[i + 1]) << 12) |
      ((B64.indexOf(clean[i + 2]) & 63) << 6) | (B64.indexOf(clean[i + 3]) & 63);
    out[o++] = (n >> 16) & 255;
    if (clean[i + 2] !== undefined) out[o++] = (n >> 8) & 255;
    if (clean[i + 3] !== undefined) out[o++] = n & 255;
  }
  return out.subarray(0, o);
}

/**
 * Lets the business pick a photo, shrinks it (max 1200 px wide, JPEG ~75%)
 * so it loads fast and stays far under the 5 MB limit, then uploads it
 * into images/biz/<businessId>/ — the only folder the database lets them write to.
 * Returns the public URL, or null if the user cancelled.
 */
export async function pickAndUploadProductImage(businessId: string): Promise<string | null> {
  const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!perm.granted && perm.accessPrivileges !== 'limited') {
    throw new Error('Please allow photo access in Settings to add product photos.');
  }
  const picked = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsEditing: true, aspect: [1, 1], quality: 1 });
  if (picked.canceled || !picked.assets?.length) return null;
  const asset = picked.assets[0];

  const ctx = ImageManipulator.manipulate(asset.uri);
  if ((asset.width || 0) > 1200) ctx.resize({ width: 1200 });
  const rendered = await ctx.renderAsync();
  const saved = await rendered.saveAsync({ format: SaveFormat.JPEG, compress: 0.75, base64: true });
  if (!saved.base64) throw new Error('Could not read the photo. Please try another one.');
  const bytes = base64ToBytes(saved.base64);

  const path = `biz/${businessId}/${Date.now()}-${Math.random().toString(36).slice(2, 10)}.jpg`;
  const { error } = await sb.storage.from('images').upload(path, bytes, { contentType: 'image/jpeg', cacheControl: '31536000', upsert: false });
  if (error) throw new Error(error.message);
  return sb.storage.from('images').getPublicUrl(path).data.publicUrl;
}

export const __test = { base64ToBytes };
