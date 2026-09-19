import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "ATLAS",
    short_name: "ATLAS",
    description: "Tactical management and analysis system for Sokker Manager",
    start_url: "/",
    display: "standalone",
    background_color: "#11181C",
    theme_color: "#11181C",
    icons: [
      {
        src: "/icons/atlas-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any"
      },
      {
        src: "/icons/atlas-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable"
      }
    ]
  };
}
