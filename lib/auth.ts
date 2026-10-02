// Single-password gate. Cookie = password ka hash — password khud kabhi cookie me nahi
export const authToken = async () => {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(`lift-log:${process.env.APP_PASSWORD}`));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
};
