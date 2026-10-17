import React, { useState } from "react";
import { Platform, ScrollView, Text } from "react-native";
import { generateRecoverySecret } from "@accesschain/core";
import type { ProfileRepo } from "../profileRepo";
import { Button } from "../ui";
import { s } from "../theme";

export function PrivacyScreen({ repo, onErased }: { repo: ProfileRepo; onErased: () => void }) {
  const [secret, setSecret] = useState<string | null>(null);
  const [msg, setMsg] = useState("");

  return (
    <ScrollView style={s.screen}>
      <Text style={s.h1} accessibilityRole="header">Privacy and recovery</Text>
      <Text style={s.p}>Your requirements are encrypted on this device. {Platform.OS === "web" ? "The key is kept in this browser's storage." : "The key is held in the phone's secure storage."} We do not hold that key and cannot read your requirements or reset access to them.</Text>
      {Platform.OS === "web" && (
        <Text style={s.p} accessibilityRole="alert">
          You are using the browser version. Browsers have no hardware-backed key storage, so protection is weaker than the phone app: the key is kept in this browser's storage and clearing site data deletes it permanently. Create a recovery secret and keep it safe.
        </Text>
      )}
      <Text style={s.h2} accessibilityRole="header">Recovery secret</Text>
      <Text style={s.p}>If you lose this phone and have no recovery secret, your saved requirements are permanently unrecoverable. Write the secret down and keep it somewhere safe. Anyone who has it can decrypt a backup.</Text>
      <Button
        label="Create a recovery secret"
        onPress={async () => {
          const { secret: raw, display } = generateRecoverySecret();
          await repo.recoveryBlob(raw); // the blob would be uploaded; the secret never is
          setSecret(display);
          setMsg("Shown once. It is not stored by the app.");
        }}
      />
      {secret && <Text style={s.mono} selectable accessibilityLabel="Recovery secret, shown once">{secret}</Text>}
      {msg !== "" && <Text style={s.muted}>{msg}</Text>}
      <Text style={s.h2} accessibilityRole="header">What leaves your phone</Text>
      <Text style={s.p}>Nothing in this build: it uses synthetic data and has no server. In a real service, a route lookup would send an approximate start point and the venue to a route provider, which is not private from that provider.</Text>
      <Text style={s.h2} accessibilityRole="header">Delete everything on this device</Text>
      <Button
        label="Erase requirements and key"
        onPress={async () => {
          await repo.erase();
          setSecret(null);
          setMsg("Erased from this device. Copies you exported elsewhere are not affected.");
          onErased();
        }}
      />
    </ScrollView>
  );
}
