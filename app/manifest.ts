import type { MetadataRoute } from "next";
import { APP_BACKGROUND } from "@/lib/pwa";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Weekly Tracker",
    short_name: "Weekly",
    description: "Project management for one person, with the week as the unit.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: APP_BACKGROUND,
    theme_color: APP_BACKGROUND,
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
