import { useEffect } from "react";

const GOOGLE_FONTS_URL =
  "https://fonts.googleapis.com/css2?" +
  "family=Inter:wght@400;500;600;700" +
  "&family=Playfair+Display:wght@400;600;700" +
  "&family=Source+Sans+Pro:wght@400;600" +
  "&family=Archivo+Black" +
  "&family=Lora:wght@400;600" +
  "&family=Lato:wght@400;700" +
  "&family=Fraunces:wght@400;600;700" +
  "&family=Mulish:wght@400;600" +
  "&family=Cormorant+Garamond:wght@400;600" +
  "&display=swap";

const LINK_ID = "store-google-fonts";

/**
 * Injects the Google Fonts <link> tag once, idempotently.
 * Renders nothing — side-effect only.
 */
export default function StoreFontLoader() {
  useEffect(() => {
    if (document.getElementById(LINK_ID)) return;
    const link = document.createElement("link");
    link.id = LINK_ID;
    link.rel = "stylesheet";
    link.href = GOOGLE_FONTS_URL;
    document.head.appendChild(link);
  }, []);

  return null;
}
