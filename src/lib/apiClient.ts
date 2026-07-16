import { API_BASE_URL } from '../config/apiConfig'

/** Kleiner fetch()-Wrapper: Basis-URL, Session-Cookie mitschicken, JSON-Header (ausser bei FormData-Uploads). */
export async function apiFetch(pfad: string, init: RequestInit = {}): Promise<Response> {
  const istFormData = init.body instanceof FormData
  return fetch(`${API_BASE_URL}${pfad}`, {
    credentials: 'include',
    ...init,
    headers: istFormData ? init.headers : { 'Content-Type': 'application/json', ...(init.headers as Record<string, string> ?? {}) },
  })
}
