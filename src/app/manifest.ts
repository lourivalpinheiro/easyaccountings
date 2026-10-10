import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Nedemy Finanças",
    short_name: "Nedemy Finanças",
    description: "Sistema de contabilidade e finanças",
    start_url: "/",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#353535",
    icons: [
      { src: "/icon.png", sizes: "256x256", type: "image/png", purpose: "any" },
      { src: "/apple-icon.png", sizes: "180x180", type: "image/png" },
    ],
  };
}
