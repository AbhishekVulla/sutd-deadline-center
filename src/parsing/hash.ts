export async function generateId(
  course: string,
  title: string,
  due_at: string,
  source_url: string
): Promise<string> {
  const text = `${course}|${title}|${due_at}|${source_url}`;
  const encoder = new TextEncoder();
  const data = encoder.encode(text);
  const hashBuffer = await crypto.subtle.digest('SHA-1', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  return hashHex;
}
