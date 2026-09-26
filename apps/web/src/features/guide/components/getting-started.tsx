"use client";

import { useMe } from "@/features/auth/me-context";
import { guideFor, type Guide } from "@gymos/api/guide/guides";
import { useGuideState } from "../use-guide-state";
import { useSetupChecks } from "../use-setup-checks";
import { GuideCard } from "./guide-card";

const NONE = new Set<string>();

/** The first-run guide on a role's home page, until the person hides it (it stays under the header's help button). */
export function GettingStarted() {
  const me = useMe();
  const guide = guideFor(me.active.role);
  return me.active.role === "top_management" ? <WithChecks guide={guide} profileId={me.profile.id} /> : <Card guide={guide} profileId={me.profile.id} auto={NONE} />;
}

function WithChecks({ guide, profileId }: { guide: Guide; profileId: string }) {
  return <Card guide={guide} profileId={profileId} auto={useSetupChecks()} />;
}

function Card({ guide, profileId, auto }: { guide: Guide; profileId: string; auto: Set<string> }) {
  const state = useGuideState(profileId, guide.id);
  if (!state.ready || state.hidden) return null;
  return <GuideCard guide={guide} done={state.done} auto={auto} onToggle={state.toggle} onHide={() => state.setHidden(true)} />;
}
