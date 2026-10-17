import React, { useState } from "react";
import { Platform, ScrollView, Text } from "react-native";
import { generateRecoverySecret } from "@accesschain/core";
import type { ProfileRepo } from "../profileRepo";
import { BackBar, Button, ConfirmCard } from "../ui";
import { useS } from "../settings";

export function PrivacyScreen({ repo, onErased, onHome }: { repo: ProfileRepo; onErased: () => void; onHome: () => void }) {
  const s = useS();
  const [secret, setSecret] = useState<string | null>(null);
  const [msg, setMsg] = useState("");
  const [asking, setAsking] = useState(false);
  const web = Platform.OS === "web";

  return (
    <ScrollView style={s.screen} contentContainerStyle={s.content} accessibilityLabel="Privacy and help">
      <BackBar onHome={onHome} />
      <Text style={s.h1} accessibilityRole="header">Privacy and help</Text>
      <Text style={s.p}>What you tell us about your needs stays on this phone, locked with a key only this phone holds. We can't read it.</Text>
      {web && (
        <Text style={s.p} accessibilityRole="alert">
          You are using the web version. Web browsers protect the key less well than the phone app, and clearing your browser data deletes it for good.
        </Text>
      )}

      <Text style={s.h2} accessibilityRole="header">Recovery code</Text>
      <Text style={s.p}>If you lose this phone, a recovery code is the only way to get your answers back. Write it down and keep it safe.</Text>
      <Button
        label="Make my recovery code"
        onPress={async () => {
          const { secret: raw, display } = generateRecoverySecret();
          await repo.recoveryBlob(raw);
          setSecret(display);
          setMsg("This is shown once. The app does not keep it.");
        }}
      />
      {secret && <Text style={s.mono} selectable accessibilityLabel="Recovery code, shown once">{secret}</Text>}
      {msg !== "" && <Text style={s.muted}>{msg}</Text>}

      <Text style={s.h2} accessibilityRole="header">Good to know</Text>
      <Text style={s.p}>In this demonstration nothing leaves your phone. A real service would send a rough start point and the venue name to a route provider, which is not private from that provider.</Text>

      <Text style={s.h2} accessibilityRole="header">Delete everything</Text>
      {!asking ? (
        <Button variant="danger" label="Delete my answers from this phone" onPress={() => setAsking(true)} />
      ) : (
        <ConfirmCard
          question="Delete your needs and your key from this phone? This can't be undone."
          yes="Yes, delete everything"
          no="No, keep it"
          onNo={() => setAsking(false)}
          onYes={async () => {
            await repo.erase();
            setSecret(null);
            setAsking(false);
            setMsg("Deleted from this phone. Copies you saved elsewhere are not affected.");
            onErased();
          }}
        />
      )}
    </ScrollView>
  );
}
