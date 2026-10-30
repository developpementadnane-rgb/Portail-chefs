import { forwardRef, type ReactNode } from "react";
import { CARD_CONFIG } from "@/lib/cardConfig";

/**
 * Carte d'adhésion — modèle unique pour tous les membres.
 * Dessinée sur une toile fixe de 1701 x 925 px (format 170,1 x 92,5 mm),
 * capturée telle quelle par html2canvas puis placée dans le PDF.
 * Le QR ne contient qu'un identifiant signé (voir server/lib/badgeToken.ts).
 */
const NAVY = "#14143f";
const RED = "#8b1a1a";
const GREEN = "#0e6b3a";

const ICONS: Record<string, ReactNode> = {
  person: (
    <>
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21c0-4.4 3.6-7 8-7s8 2.6 8 7z" />
    </>
  ),
  calendar: (
    <path d="M7 2h2v2h6V2h2v2h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2zM5 9v11h14V9zm2 2h3v3H7z" />
  ),
  flag: <path d="M5 2h2v2h11l-2.5 4.5L18 13H7v9H5z" />,
  pin: (
    <path d="M12 2a7 7 0 0 0-7 7c0 5 7 13 7 13s7-8 7-13a7 7 0 0 0-7-7zm0 9.5a2.5 2.5 0 1 1 0-5 2.5 2.5 0 0 1 0 5z" />
  ),
  group: (
    <>
      <circle cx="12" cy="7" r="3.2" />
      <circle cx="5.5" cy="9" r="2.4" />
      <circle cx="18.5" cy="9" r="2.4" />
      <path d="M6 20c0-3.6 2.7-6 6-6s6 2.4 6 6zM1 19c0-2.6 1.6-4.4 4-4.8-.8 1.2-1.2 2.9-1.2 4.8zm22 0h-2.8c0-1.9-.4-3.6-1.2-4.8 2.4.4 4 2.2 4 4.8z" />
    </>
  ),
};

interface Props {
  firstName: string;
  lastName: string;
  birthDate?: string;
  /** Image (data URL) du QR contenant le jeton signé. */
  qrCodeUrl: string;
}

function Row({ icon, label, value, y }: { icon: string; label: string; value: string; y: number }) {
  // Réduit la taille du texte pour les valeurs longues (largeur disponible ~470 px).
  const len = Math.max(value.length, 1);
  const fontSize = Math.min(37, Math.floor(470 / (len * 0.56)));
  return (
    <div style={{ position: "absolute", top: y - 30, right: 93, width: 900, height: 60, direction: "rtl" }}>
      <span
        style={{
          position: "absolute", right: 0, top: 7, width: 46, height: 46, borderRadius: "50%",
          background: NAVY, display: "flex", alignItems: "center", justifyContent: "center",
        }}
      >
        <svg viewBox="0 0 24 24" width="26" height="26" fill="#fff">{ICONS[icon]}</svg>
      </span>
      <span style={{ position: "absolute", right: 62, top: 7, fontSize: 29, fontWeight: 700, color: NAVY, whiteSpace: "nowrap" }}>
        {label}
      </span>
      <span
        dir="auto"
        style={{ position: "absolute", right: 372, top: 2, fontSize, color: RED, whiteSpace: "nowrap", lineHeight: "56px" }}
      >
        {value}
      </span>
    </div>
  );
}

export const MemberCard = forwardRef<HTMLDivElement, Props>(function MemberCard(
  { firstName, lastName, birthDate, qrCodeUrl },
  ref,
) {
  return (
    <div
      ref={ref}
      dir="ltr"
      style={{
        position: "relative", width: 1701, height: 925, background: "#f4f4f4", overflow: "hidden",
        fontFamily: "Tahoma, 'Noto Sans Arabic', 'DejaVu Sans', sans-serif",
      }}
    >
      <img src="/card/left-bg.png" alt="" style={{ position: "absolute", left: 0, top: 0, width: 720, height: 925 }} />
      <img src="/card/header.jpg" alt="" style={{ position: "absolute", left: 470, top: 0, width: 1231, height: 262 }} />

      {CARD_CONFIG.hasShmLogo && (
        <img src="/card/logo-shm.png" alt="" style={{ position: "absolute", left: 70, top: 38, height: 215, width: "auto", maxWidth: 230, objectFit: "contain" }} />
      )}
      <img
        src="/card/logo-groupe.png"
        alt=""
        style={{ position: "absolute", left: CARD_CONFIG.hasShmLogo ? 320 : 70, top: 38, height: 215, width: "auto", maxWidth: 230, objectFit: "contain" }}
      />

      <div
        style={{
          position: "absolute", left: 100, top: 300, width: 540, height: 590, background: "#fff", borderRadius: 30,
          border: "2px solid #dcdcd6", boxShadow: "0 10px 30px rgba(20,20,63,.12)",
        }}
      >
        {qrCodeUrl && <img src={qrCodeUrl} alt="QR" style={{ position: "absolute", left: 40, top: 40, width: 460, height: 460 }} />}
        <div style={{ position: "absolute", left: 0, right: 0, top: 515, textAlign: "center", fontSize: 23, color: "#6b6b73", lineHeight: 1.3 }}>
          Lisible uniquement par l'application
          <br />
          et le site des chefs
        </div>
      </div>

      <div style={{ position: "absolute", left: 830, width: 800, top: 540, height: 2, background: GREEN, opacity: 0.85 }}>
        <span
          style={{
            position: "absolute", left: "50%", top: -14, transform: "translateX(-50%)", background: "#f4f4f4",
            color: GREEN, fontSize: 24, padding: "0 14px", lineHeight: "30px",
          }}
        >
          ◈
        </span>
      </div>

      <Row icon="person" label="الاسم و النسب:" value={`${firstName} ${lastName}`.trim()} y={345} />
      <Row icon="calendar" label="تاريخ الازدياد:" value={birthDate || ""} y={445} />
      <Row icon="flag" label="الموسم الكشفي:" value={CARD_CONFIG.season} y={625} />
      <Row icon="pin" label="الفرع:" value={CARD_CONFIG.branch} y={725} />
      <Row icon="group" label="الفوج:" value={CARD_CONFIG.troop} y={825} />
    </div>
  );
});
