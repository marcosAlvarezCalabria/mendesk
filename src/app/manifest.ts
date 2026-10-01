import type { MetadataRoute } from "next";
import { storeConfig } from "@/config/currentStore";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: storeConfig.identity.name,
    short_name: storeConfig.identity.shortName,
    start_url: "/orders",
    display: "standalone",
    background_color: "#FBF9F5",
    theme_color: "#211D18",
    icons: [
      {
        src: storeConfig.identity.logo.src,
        sizes: "any",
        type: "image/svg+xml",
      },
    ],
  };
}
