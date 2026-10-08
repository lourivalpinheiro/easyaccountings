import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Easy Accountings",
    short_name: "Easy Accountings",
    description: "Sistema de contabilidade",
    start_url: "/",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#155dfc",
    icons: [
      { src: "/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" },
      { src: "/apple-icon", sizes: "180x180", type: "image/png" },
    ],
  };
}
