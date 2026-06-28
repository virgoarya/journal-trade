export const env = {
  siteUrl: process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000",
  backendUrl: process.env.BACKEND_URL || "http://localhost:3001",
};

console.log("Current Backend URL:", env.backendUrl);