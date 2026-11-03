import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Irish Dance Connect",
    short_name: "Dance Connect",
    description: "Feis calendar, school directory and dress & gear marketplace for Irish dance families.",
    start_url: "/",
    display: "standalone",
    background_color: "#f8faf9",
    theme_color: "#0b7a45",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icons/icon-512-maskable.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
