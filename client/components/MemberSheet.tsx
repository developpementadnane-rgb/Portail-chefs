import { forwardRef } from "react";
import { CARD_CONFIG } from "@/lib/cardConfig";

/**
 * Fiche technique du membre — modèle unique (A4, 794 x 1123 px).
 * Document confidentiel : contient les données personnelles d'un mineur.
 */
const NAVY = "#14143f";
const RED = "#8b1a1a";
const GREEN = "#0e6b3a";

export interface SheetData {
  memberId: string;
  firstName: string;
  lastName: string;
  birthDate?: string;
  gender?: string;
  patrolName?: string;
  roleName?: string;
  userPhone?: string;
  email?: string;
  guardianFirstName?: string;
  guardianLastName?: string;
  guardianRelationship?: string;
  guardianRelationshipOther?: string;
  guardianCin?: string;
  fatherPhone?: string;
  motherPhone?: string;
  homePhone?: string;
  additionalInfo?: string;
  qrCodeUrl: string;
}

const REL: Record<string, string> = { father: "الأب · Père", mother: "الأم · Mère", other: "آخر · Autre" };

function ageOf(birth?: string): number | null {
  if (!birth) return null;
  const d = new Date(birth);
  if (Number.isNaN(d.getTime())) return null;
  const now = new Date();
  let age = now.getFullYear() - d.getFullYear();
  if (now.getMonth() < d.getMonth() || (now.getMonth() === d.getMonth() && now.getDate() < d.getDate())) age--;
  return age;
}

type Item = [string, string, string | undefined | null];

function Section({ ar, fr, items }: { ar: string; fr: string; items: Item[] }) {
  return (
    <section style={{ background: "#fff", border: "1.5px solid #dcdcd6", borderRadius: 12, padding: "6px 16px 3px" }}>
      <h2
        style={{
          margin: "0 0 2px", fontSize: 14, color: GREEN, display: "flex", gap: 10, alignItems: "baseline",
          borderBottom: `1.5px solid ${GREEN}55`, paddingBottom: 5,
        }}
      >
        <b>{ar}</b>
        <small style={{ fontSize: 10.5, color: "#777", fontWeight: 400, direction: "ltr" }}>{fr}</small>
      </h2>
      {items.map(([k, kfr, v], i) => (
        <div
          key={k}
          style={{
            display: "flex", alignItems: "center", justifyContent: "space-between", padding: "2.5px 0",
            borderBottom: i === items.length - 1 ? "0" : "1px solid #eee",
          }}
        >
          <div style={{ width: "42%", color: NAVY }}>
            <b style={{ fontSize: 12, display: "block", lineHeight: 1.25 }}>{k}</b>
            <small style={{ fontSize: 9, lineHeight: 1.2, color: "#888", direction: "ltr", display: "block", textAlign: "right" }}>{kfr}</small>
          </div>
          <div dir="auto" style={{ width: "58%", textAlign: "left", fontSize: 12.5, color: RED, fontWeight: 700, wordBreak: "break-word", direction: "ltr" }}>
            {v ? v : <span style={{ color: "#bbb" }}>—</span>}
          </div>
        </div>
      ))}
    </section>
  );
}

export const MemberSheet = forwardRef<HTMLDivElement, { data: SheetData }>(function MemberSheet({ data }, ref) {
  const age = ageOf(data.birthDate);
  const guardian = `${data.guardianFirstName || ""} ${data.guardianLastName || ""}`.trim();
  const relation =
    data.guardianRelationship === "other" && data.guardianRelationshipOther
      ? data.guardianRelationshipOther
      : REL[data.guardianRelationship || ""] || data.guardianRelationship;
  const sex = data.gender === "male" ? "ذكر · Masculin" : data.gender === "female" ? "أنثى · Féminin" : undefined;
  const today = new Date().toLocaleDateString("fr-FR");

  return (
    <div
      ref={ref}
      dir="ltr"
      style={{
        position: "relative", width: 794, height: 1123, background: "#f4f4f4", overflow: "hidden", color: "#222",
        fontFamily: "Tahoma, 'Noto Sans Arabic', 'DejaVu Sans', sans-serif",
      }}
    >
      <img src="/card/header.jpg" alt="" style={{ width: 794, height: 169, display: "block" }} />

      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "6px 34px 2px", direction: "rtl" }}>
        <h1 style={{ margin: 0, fontSize: 23, color: NAVY, lineHeight: 1.3 }}>
          بطاقة المعلومات التقنية للعضو
          <small style={{ display: "block", fontSize: 12, color: "#666", fontWeight: 400, direction: "ltr", textAlign: "right" }}>
            FICHE TECHNIQUE DU MEMBRE
          </small>
        </h1>
        <div style={{ display: "flex", alignItems: "center", gap: 14, direction: "ltr" }}>
          <div style={{ display: "flex", gap: 10 }}>
            {CARD_CONFIG.hasShmLogo && <img src="/card/logo-shm.png" alt="" style={{ height: 70 }} />}
            <img src="/card/logo-groupe.png" alt="" style={{ height: 70 }} />
          </div>
          <div style={{ width: 104, background: "#fff", border: "1.5px solid #dcdcd6", borderRadius: 10, padding: 5, textAlign: "center" }}>
            {data.qrCodeUrl && <img src={data.qrCodeUrl} alt="QR" style={{ width: 92, height: 92 }} />}
            <p style={{ margin: "2px 0 0", fontSize: 7, color: "#777", lineHeight: 1.3 }}>
              Lisible uniquement par
              <br />
              l'application des chefs
            </p>
          </div>
        </div>
      </div>

      <main style={{ padding: "6px 34px 0", display: "grid", gridTemplateColumns: "1fr", gap: 8, direction: "rtl" }}>
        <Section
          ar="الهوية"
          fr="Identité"
          items={[
            ["الاسم الكامل", "Nom complet", `${data.firstName} ${data.lastName}`.trim()],
            ["رقم العضو", "Identifiant", data.memberId],
            ["تاريخ الازدياد", "Date de naissance", data.birthDate ? `${data.birthDate}${age !== null ? `  (${age} ans)` : ""}` : undefined],
            ["الجنس", "Sexe", sex],
            ["الدورية", "Patrouille", data.patrolName],
            ["الصفة", "Rôle", data.roleName],
            ["الهاتف", "Téléphone", data.userPhone],
            ["البريد الإلكتروني", "E-mail", data.email],
          ]}
        />
        <Section
          ar="الولي"
          fr="Tuteur"
          items={[
            ["الاسم الكامل", "Nom complet", guardian],
            ["صلة القرابة", "Lien", relation],
            ["رقم البطاقة الوطنية", "CIN", data.guardianCin],
            ["هاتف الأب", "Tél. père", data.fatherPhone],
            ["هاتف الأم", "Tél. mère", data.motherPhone],
            ["هاتف المنزل", "Tél. domicile", data.homePhone],
          ]}
        />
        <Section ar="معلومات إضافية" fr="Informations médicales et complémentaires" items={[["ملاحظات", "Notes", data.additionalInfo]]} />
        <Section
          ar="الملف"
          fr="Dossier"
          items={[
            ["الوثائق", "Documents", "غير مكتملة · incomplets"],
            ["الاشتراك", "Cotisation", "غير مؤداة · non payée"],
            ["تاريخ التسجيل", "Inscrit le", today],
          ]}
        />
      </main>

      <div style={{ position: "absolute", left: 34, right: 34, bottom: 26, fontSize: 9.5, color: "#777", lineHeight: 1.55, textAlign: "right", direction: "ltr" }}>
        <b style={{ color: RED }}>Document confidentiel.</b> Contient des données personnelles d'un mineur : à ne remettre qu'au membre et à son tuteur.
        <br />
        Généré le {today} · Scoutisme Hassania Marocain
      </div>
    </div>
  );
});
