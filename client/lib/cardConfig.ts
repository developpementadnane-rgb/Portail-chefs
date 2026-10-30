/**
 * Réglages communs de la carte d'adhésion et de la fiche technique.
 * UN seul modèle pour tous les membres : on ne change que ces valeurs
 * (une fois par saison), jamais le dessin.
 */
export const CARD_CONFIG = {
  season: "2025/2026",
  branch: "آسفي",
  troop: "فوج عمر الفاروق",
  /** Passer à true quand public/card/logo-shm.png est ajouté. */
  hasShmLogo: false,
};

/** Images à charger avant la capture (html2canvas ne capture pas une image pas encore chargée). */
export const CARD_IMAGES = [
  "/card/header.jpg",
  "/card/left-bg.png",
  "/card/logo-groupe.png",
  ...(CARD_CONFIG.hasShmLogo ? ["/card/logo-shm.png"] : []),
];

export function preloadImages(urls: string[]): Promise<void> {
  return Promise.all(
    urls.map(
      (src) =>
        new Promise<void>((resolve, reject) => {
          const img = new Image();
          img.onload = () => resolve();
          img.onerror = () => reject(new Error(`Image introuvable : ${src}`));
          img.src = src;
        }),
    ),
  ).then(() => undefined);
}
