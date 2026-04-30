import { redirect } from '@sveltejs/kit';

export function load({ url }: { url: URL }) {
  const pin = url.searchParams.get('pin');
  redirect(307, `/admin?tab=screens${pin ? `&pin=${encodeURIComponent(pin)}` : ''}`);
}
