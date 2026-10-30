import { useEffect, useRef, useState } from "react";
import QRCode from "qrcode";
import { jsPDF } from "jspdf";
import html2canvas from "html2canvas";
import { API_BASE_URL } from "@/lib/apiConfig";
import { encryptBadgePayload } from "@/lib/badgeCrypto";
import { preloadImages, CARD_IMAGES } from "@/lib/cardConfig";
import { MemberCard } from "@/components/MemberCard";
import { MemberSheet, type SheetData } from "@/components/MemberSheet";

/**
 * Demandes d'inscription membres en attente de validation (bloc 3).
 * À l'acceptation : transfert vers "users" côté serveur, puis -- ici,
 * côté client -- génération du QR signé (AES partagé, en attendant le
 * futur système de présence) et rendu hors-écran de MemberCard /
 * MemberSheet, capturés en PDF via html2canvas + jsPDF (même technique
 * que l'ancien AccountConfirmation.tsx côté portail Membres), puis
 * envoi des 3 pièces jointes par e-mail.
 */

interface PendingRequest {
  id: string;
  generated_id: string;
  first_name: string;
  last_name: string;
  birth_date: string;
  gender: string;
  user_phone: string;
  email: string;
  patrol_id: number | null;
  role_id: number | null;
  guardian_first_name: string | null;
  guardian_last_name: string | null;
  guardian_relationship: string | null;
  guardian_cin: string | null;
  father_phone: string | null;
  mother_phone: string | null;
  home_phone: string | null;
  additional_info: string | null;
  status: string;
  created_at: string;
}

function authHeaders() {
  const token = localStorage.getItem("auth_token") || sessionStorage.getItem("auth_token") || "";
  return { "Content-Type": "application/json", Authorization: `Bearer ${token}` };
}

async function canvasToPdfBase64(el: HTMLElement, widthMm: number, heightMm: number): Promise<string> {
  const canvas = await html2canvas(el, { scale: 2, useCORS: true, backgroundColor: "#f4f4f4" });
  const img = canvas.toDataURL("image/png");
  const pdf = new jsPDF({ orientation: widthMm > heightMm ? "landscape" : "portrait", unit: "mm", format: [widthMm, heightMm] });
  pdf.addImage(img, "PNG", 0, 0, widthMm, heightMm);
  return pdf.output("datauristring").split(",")[1];
}

export default function PendingRegistrations() {
  const [requests, setRequests] = useState<PendingRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [renderTarget, setRenderTarget] = useState<{ req: PendingRequest; qrDataUrl: string } | null>(null);

  const cardRef = useRef<HTMLDivElement>(null);
  const sheetRef = useRef<HTMLDivElement>(null);
  const resolveRenderRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    preloadImages(CARD_IMAGES).catch((e) => console.warn("Préchargement des images de carte échoué:", e));
    fetchRequests();
  }, []);

  async function fetchRequests() {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`${API_BASE_URL}/api/pending-registrations`, { headers: authHeaders() });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Erreur de chargement");
      setRequests(json.data || []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur de chargement");
    } finally {
      setLoading(false);
    }
  }

  async function handleReject(id: string) {
    if (!confirm("Refuser cette demande ?")) return;
    setProcessingId(id);
    try {
      const res = await fetch(`${API_BASE_URL}/api/pending-registrations/${id}/reject`, {
        method: "POST",
        headers: authHeaders(),
      });
      if (!res.ok) throw new Error((await res.json()).error || "Erreur");
      setRequests((prev) => prev.filter((r) => r.id !== id));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur lors du refus");
    } finally {
      setProcessingId(null);
    }
  }

  async function handleAccept(req: PendingRequest) {
    setProcessingId(req.id);
    setError("");
    try {
      // 1) Transfert serveur pending_registrations -> users.
      const acceptRes = await fetch(`${API_BASE_URL}/api/pending-registrations/${req.id}/accept`, {
        method: "POST",
        headers: authHeaders(),
      });
      const acceptJson = await acceptRes.json();
      if (!acceptRes.ok) throw new Error(acceptJson.error || "Échec de l'acceptation");

      // 2) QR signé (AES partagé -- voir badgeCrypto.ts).
      const token = await encryptBadgePayload({
        i: req.generated_id,
        f: req.first_name,
        l: req.last_name,
        b: req.birth_date || null,
        gf: req.guardian_first_name || null,
        gl: req.guardian_last_name || null,
        gp: req.father_phone || null,
        gp2: req.mother_phone || null,
        m: req.additional_info || null,
      });
      const qrDataUrl = await QRCode.toDataURL(token, { width: 920, margin: 1 });

      // 3) Rendu hors-écran de MemberCard + MemberSheet, puis capture PDF.
      await new Promise<void>((resolve) => {
        resolveRenderRef.current = resolve;
        setRenderTarget({ req, qrDataUrl });
      });

      if (!cardRef.current || !sheetRef.current) throw new Error("Rendu des documents impossible");

      const [cardBase64, sheetBase64] = await Promise.all([
        canvasToPdfBase64(cardRef.current, 170.1, 92.5),
        canvasToPdfBase64(sheetRef.current, 210, 297),
      ]);

      // QR seul, en image PNG (en plus des PDF, pour un usage mobile rapide).
      const qrPngBase64 = qrDataUrl.split(",")[1];

      setRenderTarget(null);

      // 4) Envoi email avec les 3 pièces jointes.
      const sendRes = await fetch(`${API_BASE_URL}/api/members/send-documents`, {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({
          to: req.email,
          firstName: req.first_name,
          lastName: req.last_name,
          birthDate: req.birth_date,
          generatedId: req.generated_id,
          attachments: [
            { filename: `carte-adhesion-${req.generated_id}.pdf`, base64: cardBase64, contentType: "application/pdf" },
            { filename: `fiche-membre-${req.generated_id}.pdf`, base64: sheetBase64, contentType: "application/pdf" },
            { filename: `qr-${req.generated_id}.png`, base64: qrPngBase64, contentType: "image/png" },
          ],
        }),
      });
      if (!sendRes.ok) {
        // Le membre est déjà transféré vers "users" à ce stade : ne pas
        // bloquer dessus, juste prévenir le chef que l'envoi a échoué.
        console.error("Échec envoi documents:", await sendRes.json().catch(() => null));
        setError(`${req.first_name} ${req.last_name} authentifié, mais l'envoi des documents par e-mail a échoué. Réessayez depuis la fiche membre.`);
      }

      setRequests((prev) => prev.filter((r) => r.id !== req.id));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur lors de l'authentification du membre");
      setRenderTarget(null);
    } finally {
      setProcessingId(null);
    }
  }

  // Dès que le rendu hors-écran est monté (ref disponible), on signale au
  // flux d'acceptation qu'il peut procéder à la capture.
  useEffect(() => {
    if (renderTarget && cardRef.current && sheetRef.current && resolveRenderRef.current) {
      const resolve = resolveRenderRef.current;
      resolveRenderRef.current = null;
      // Laisse le temps au navigateur de peindre les <img> avant la capture.
      requestAnimationFrame(() => requestAnimationFrame(resolve));
    }
  }, [renderTarget]);

  const sheetData: SheetData | null = renderTarget
    ? {
        memberId: renderTarget.req.generated_id,
        firstName: renderTarget.req.first_name,
        lastName: renderTarget.req.last_name,
        birthDate: renderTarget.req.birth_date,
        gender: renderTarget.req.gender,
        userPhone: renderTarget.req.user_phone,
        email: renderTarget.req.email,
        guardianFirstName: renderTarget.req.guardian_first_name || undefined,
        guardianLastName: renderTarget.req.guardian_last_name || undefined,
        guardianRelationship: renderTarget.req.guardian_relationship || undefined,
        guardianCin: renderTarget.req.guardian_cin || undefined,
        fatherPhone: renderTarget.req.father_phone || undefined,
        motherPhone: renderTarget.req.mother_phone || undefined,
        homePhone: renderTarget.req.home_phone || undefined,
        additionalInfo: renderTarget.req.additional_info || undefined,
        qrCodeUrl: renderTarget.qrDataUrl,
      }
    : null;

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <h1 className="text-2xl font-bold mb-1">Demandes d'inscription en attente</h1>
      <p className="text-gray-500 mb-6">
        Vérifiez les informations avant d'authentifier un membre : la carte, la fiche et le QR lui seront envoyés automatiquement.
      </p>

      {error && <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">{error}</div>}

      {loading ? (
        <p className="text-gray-500">Chargement…</p>
      ) : requests.length === 0 ? (
        <p className="text-gray-500">Aucune demande en attente.</p>
      ) : (
        <div className="space-y-4">
          {requests.map((req) => (
            <div key={req.id} className="border border-gray-200 rounded-lg p-4 flex items-start justify-between gap-4">
              <div>
                <p className="font-semibold">{req.first_name} {req.last_name}</p>
                <p className="text-sm text-gray-500">{req.generated_id} · {req.birth_date} · {req.user_phone}</p>
                <p className="text-sm text-gray-500">{req.email}</p>
                {req.guardian_first_name && (
                  <p className="text-sm text-gray-500 mt-1">
                    Tuteur : {req.guardian_first_name} {req.guardian_last_name} ({req.guardian_relationship})
                  </p>
                )}
                {req.additional_info && <p className="text-sm text-amber-700 mt-1">Infos : {req.additional_info}</p>}
              </div>
              <div className="flex gap-2 shrink-0">
                <button
                  onClick={() => handleAccept(req)}
                  disabled={processingId === req.id}
                  className="px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-medium disabled:opacity-50"
                >
                  {processingId === req.id ? "Authentification…" : "Authentifier"}
                </button>
                <button
                  onClick={() => handleReject(req.id)}
                  disabled={processingId === req.id}
                  className="px-4 py-2 bg-red-50 text-red-700 border border-red-200 rounded-lg text-sm font-medium disabled:opacity-50"
                >
                  Refuser
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Rendu hors-écran : jamais visible, juste capturé par html2canvas. */}
      {renderTarget && sheetData && (
        <div style={{ position: "fixed", left: -99999, top: 0 }} aria-hidden>
          <MemberCard
            ref={cardRef}
            firstName={renderTarget.req.first_name}
            lastName={renderTarget.req.last_name}
            birthDate={renderTarget.req.birth_date}
            qrCodeUrl={renderTarget.qrDataUrl}
          />
          <MemberSheet ref={sheetRef} data={sheetData} />
        </div>
      )}
    </div>
  );
}
