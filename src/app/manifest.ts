import type { MetadataRoute } from "next";
import { brand } from "@/lib/site";

/**
 * /manifest.webmanifest — the studio's name and S mark for browsers, home
 * screens and crawlers. Every icon is one of the brand files already served
 * (app/icon.svg, app/icon.png, app/apple-icon.png, public/brand/).
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: brand.name,
    short_name: brand.name,
    description: brand.description,
    start_url: "/",
    display: "browser",
    background_color: "#000000",
    theme_color: "#000000",
    icons: [
      { src: "/icon.svg", type: "image/svg+xml", sizes: "any" },
      { src: "/icon.png", type: "image/png", sizes: "192x192" },
      { src: "/apple-icon.png", type: "image/png", sizes: "180x180" },
      { src: brand.logo, type: "image/png", sizes: "512x512" },
    ],
  };
}
