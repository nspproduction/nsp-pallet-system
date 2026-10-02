// Fetch that returns { data, error }. `data` is only set when response is JSON-parseable and shape matches.
export async function safeFetchJson<T>(
  input: RequestInfo,
  init?: RequestInit,
): Promise<{ data: T | null; error: string | null }> {
  try {
    const res = await fetch(input, init);
    let body: unknown = null;
    try {
      body = await res.json();
    } catch {
      /* body may be empty */
    }
    if (!res.ok) {
      const err = (body as { error?: string } | null)?.error;
      if (err === "unauthenticated") {
        return { data: null, error: "กรุณา login ที่หน้าแรกของ LIFF (/liff) ก่อน" };
      }
      return { data: null, error: err ?? `HTTP ${res.status}` };
    }
    return { data: body as T, error: null };
  } catch (e) {
    return { data: null, error: e instanceof Error ? e.message : String(e) };
  }
}
