import { redirect } from '@sveltejs/kit';

export const prerender = false;

export function load() {
  redirect(307, '/admin?tab=studio');
}
