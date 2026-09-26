import { Redirect } from "expo-router";
import { useState } from "react";
import { View } from "react-native";
import { t, type MessageKey } from "@gymos/i18n";
import { toE164 } from "@gymos/api/phone";
import { useSession } from "@/auth/session";
import { createClient } from "@/lib/supabase";
import { space } from "@/theme";
import { Button } from "@/ui/button";
import { Field } from "@/ui/field";
import { Screen } from "@/ui/screen";
import { Text } from "@/ui/text";

type Tab = "member" | "staff";

function errorKey(message: string): MessageKey {
  const m = message.toLowerCase();
  if (m.includes("invalid login")) return "login.error.invalid";
  if (m.includes("token has expired") || m.includes("invalid") && m.includes("otp")) return "login.error.codeInvalid";
  if (m.includes("signups not allowed") || m.includes("user not found")) return "login.error.unknownPhone";
  if (m.includes("rate limit") || m.includes("too many")) return "login.error.tooMany";
  return "error.generic";
}

/** Members: phone + one-time code. Staff: email + password (the same accounts as the web). */
export default function Login() {
  const { state } = useSession();
  const [tab, setTab] = useState<Tab>("member");
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<MessageKey | null>(null);
  if (state.status === "ready") return <Redirect href="/" />;

  const run = async (fn: () => Promise<{ error: { message: string } | null }>) => {
    setBusy(true);
    setError(null);
    const { error: e } = await fn().catch((x: Error) => ({ error: { message: x.message } }));
    setBusy(false);
    if (e) setError(errorKey(e.message));
    return !e;
  };
  const auth = () => createClient().auth;
  const sendCode = async () => {
    const e164 = toE164(phone);
    if (!e164) return setError("login.error.unknownPhone");
    if (await run(() => auth().signInWithOtp({ phone: e164, options: { shouldCreateUser: false } }))) setSentTo(e164);
  };
  const verify = () => {
    if (!/^\d{6}$/.test(code)) return setError("login.error.codeFormat");
    void run(() => auth().verifyOtp({ phone: sentTo!, token: code, type: "sms" }));
  };
  const staffSignIn = () => {
    if (!email.includes("@")) return setError("login.error.email");
    if (!password) return setError("login.error.passwordRequired");
    void run(() => auth().signInWithPassword({ email: email.trim(), password }));
  };

  return (
    <Screen title={t("login.title")} subtitle={t("login.description")} testID="login">
      <View accessibilityRole="tablist" style={{ flexDirection: "row", gap: space[2] }}>
        {(["member", "staff"] as Tab[]).map((k) => (
          <Button key={k} label={t(`login.tab.${k}`)} variant={tab === k ? "primary" : "outline"} accessibilityRole="tab" selected={tab === k} style={{ flex: 1 }} onPress={() => { setTab(k); setError(null); }} />
        ))}
      </View>
      {tab === "member" ? (
        sentTo ? (
          <View style={{ gap: space[3] }}>
            <Text variant="muted">{t("login.codeSent")}</Text>
            <Field label={t("login.code")} value={code} onChangeText={setCode} keyboardType="number-pad" autoComplete="one-time-code" maxLength={6} />
            <Button block label={busy ? t("login.signingIn") : t("login.verify")} busy={busy} onPress={verify} />
            <Button block label={t("login.changeNumber")} variant="ghost" onPress={() => { setSentTo(null); setCode(""); }} />
          </View>
        ) : (
          <View style={{ gap: space[3] }}>
            <Field label={t("login.phone")} value={phone} onChangeText={setPhone} keyboardType="phone-pad" autoComplete="tel" placeholder="010 0000 0000" />
            <Button block label={busy ? t("login.sendingCode") : t("login.sendCode")} busy={busy} onPress={() => void sendCode()} />
          </View>
        )
      ) : (
        <View style={{ gap: space[3] }}>
          <Field label={t("login.email")} value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" autoComplete="email" />
          <Field label={t("login.password")} value={password} onChangeText={setPassword} secureTextEntry autoComplete="password" />
          <Button block label={busy ? t("login.signingIn") : t("login.signIn")} busy={busy} onPress={staffSignIn} />
        </View>
      )}
      {error ? <Text variant="error" accessibilityRole="alert">{t(error)}</Text> : null}
    </Screen>
  );
}
