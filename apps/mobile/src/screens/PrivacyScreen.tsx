import React, { useState } from "react";
import { Platform, ScrollView, Text } from "react-native";
import { generateRecoverySecret } from "@accesschain/core";
import type { ProfileRepo } from "../profileRepo";
import { ATTRIBUTION } from "@accesschain/core";
import { useLive } from "../live";
import { BackBar, Button, ConfirmCard } from "../ui";
import { useS } from "../settings";

export function PrivacyScreen({ repo, onErased, onHome }: { repo: ProfileRepo; onErased: () => void; onHome: () => void }) {
  const s = useS();
  const [secret, setSecret] = useState<string | null>(null);
  const [msg, setMsg] = useState("");
  const [asking, setAsking] = useState(false);
  const web = Platform.OS === "web";
  const { mode, setMode } = useLive();

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

      <Text style={s.h2} accessibilityRole="header">Live information</Text>
      <Text style={s.p}>
        {mode === "live"
          ? "Live information is on. The app asks TfL for routes and lift news (your start station or rough location, rounded to about 100 metres, and the place's position) and OpenStreetMap for the place's name and notes. They can see your internet address. Your needs are never sent."
          : "Live information is off. Nothing leaves your phone. The demonstration places are made up."}
      </Text>
      {mode === "live" ? (
        <Button label="Switch to the demonstration places" onPress={() => setMode("demo")} />
      ) : (
        <Button label="Use live information (contacts TfL and OpenStreetMap)" onPress={() => setMode("live")} />
      )}

      <Text style={s.h2} accessibilityRole="header">Where the information comes from</Text>
      {ATTRIBUTION.map((a) => <Text key={a} style={s.p}>{a}</Text>)}
      <Text style={s.p}>Notes written by the public have not been checked by us and can be wrong or out of date. Always confirm with the venue.</Text>

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
