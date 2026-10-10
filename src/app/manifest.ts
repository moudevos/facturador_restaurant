import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Facturador Restaurant",
    short_name: "Facturador",
    description: "POS, caja y facturación electrónica para restaurante.",
    start_url: "/dashboard",
    scope: "/",
    display: "standalone",
    background_color: "#f6f3ec",
    theme_color: "#14201b",
    orientation: "any",
    categories: ["business", "finance"],
    icons: [
      {
        src: "/icons/app-icon.svg",
        sizes: "any",
        type: "image/svg+xml",
        purpose: "any",
      },
      {
        src: "/icons/maskable-icon.svg",
        sizes: "any",
        type: "image/svg+xml",
        purpose: "maskable",
      },
    ],
  };
}
