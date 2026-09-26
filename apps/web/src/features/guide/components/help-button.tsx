"use client";

import { CircleHelp } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Sheet } from "@/components/ui/sheet";
import { useMe } from "@/features/auth/me-context";
import { guideFor, type Guide } from "@gymos/api/guide/guides";
import { t } from "@gymos/i18n";
import { useGuideState } from "../use-guide-state";
import { useSetupChecks } from "../use-setup-checks";
import { GuideCard } from "./guide-card";

const NONE = new Set<string>();

/** Header "?" — the role's guide, any time, and a way to put it back on the home page. */
export function HelpButton() {
  const me = useMe();
  const guide = guideFor(me.active.role);
  const state = useGuideState(me.profile.id, guide.id);
  const [open, setOpen] = useState(false);
  const [notice, setNotice] = useState("");
  return (
    <>
      <Button variant="ghost" size="icon" aria-label={t("guide.help")} onClick={() => { setNotice(""); setOpen(true); }} data-testid="help-button">
        <CircleHelp aria-hidden />
      </Button>
      <Sheet open={open} onClose={() => setOpen(false)} title={t("guide.helpTitle")} closeLabel={t("common.close")}>
        <div className="grid gap-4">
          {me.active.role === "top_management" ? <AdminGuide guide={guide} done={state.done} onToggle={state.toggle} /> : <GuideCard guide={guide} done={state.done} auto={NONE} onToggle={state.toggle} framed={false} />}
          {state.hidden ? (
            <Button variant="outline" onClick={() => { state.setHidden(false); setNotice(t("guide.shownOnHome")); }}>
              {t("guide.showOnHome")}
            </Button>
          ) : null}
          <p role="status" className="text-sm text-success empty:hidden">{notice}</p>
        </div>
      </Sheet>
    </>
  );
}

function AdminGuide({ guide, done, onToggle }: { guide: Guide; done: Set<string>; onToggle: (id: string) => void }) {
  return <GuideCard guide={guide} done={done} auto={useSetupChecks()} onToggle={onToggle} framed={false} />;
}
