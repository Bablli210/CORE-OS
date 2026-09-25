"use client";

import { useQuery } from "@tanstack/react-query";
import QRCode from "qrcode";
import { createClient } from "@/lib/supabase/client";
import { t } from "@/lib/i18n";

async function kioskQr(branch: string): Promise<{ url: string; svg: string }> {
  const { data, error } = await createClient().rpc("fn_kiosk_code", { p_branch: branch });
  if (error) throw error;
  const url = `${window.location.origin}/c/here?b=${branch}&k=${data}`;
  return { url, svg: await QRCode.toString(url, { type: "svg", margin: 1, errorCorrectionLevel: "M" }) };
}

/** The QR members scan with their phone camera to check in ("I'm here"). The code changes every day (fn_kiosk_code). */
export function KioskQr({ branch }: { branch: string }) {
  const qr = useQuery({ queryKey: ["kiosk-qr", branch], queryFn: () => kioskQr(branch), refetchInterval: 10 * 60_000 });
  if (!qr.data) return null;
  return (
    <figure className="grid justify-items-center gap-2" data-testid="kiosk-qr" data-url={qr.data.url}>
      {/* the SVG comes from the qrcode library, built from our own URL */}
      <div className="size-44 rounded-lg bg-background p-2 [&_svg]:size-full" role="img" aria-label={t("kiosk.qrLabel")} dangerouslySetInnerHTML={{ __html: qr.data.svg }} />
      <figcaption className="text-center text-sm text-muted-foreground">{t("kiosk.qrHint")}</figcaption>
    </figure>
  );
}
