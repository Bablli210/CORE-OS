/** tel: and wa.me links from an E.164 number (wa.me wants digits only). */
export const telLink = (e164: string) => `tel:${e164}`;
export const whatsappLink = (e164: string, text?: string) =>
  `https://wa.me/${e164.replace(/\D/g, "")}${text ? `?text=${encodeURIComponent(text)}` : ""}`;
