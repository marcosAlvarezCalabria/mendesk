import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Koko Atelier",
    short_name: "Koko",
    start_url: "/orders",
    display: "standalone",
    background_color: "#FBF9F5",
    theme_color: "#211D18",
    icons: [
      {
        src: "/icons/koko-icon-192.png",
        sizes: "192x192",
        type: "image/png",
      },
      {
        src: "/icons/koko-icon-512.png",
        sizes: "512x512",
        type: "image/png",
      },
    ],
  };
}