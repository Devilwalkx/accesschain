import React, { useRef, useState } from "react";
import { ScrollView, Text, TextInput } from "react-native";
import { bytesToHex, randomBytes } from "@noble/ciphers/utils.js";
import { ReportIntake, type AttributeKey } from "@accesschain/core";
import { pickAndSanitisePhoto } from "../photo";
import { Button, SyntheticBanner } from "../ui";
import { s } from "../theme";

const OPTIONS: Array<{ label: string; attribute: AttributeKey; value: boolean }> = [
  { label: "Entrance is step-free", attribute: "stepFree", value: true },
  { label: "Entrance has steps", attribute: "stepFree", value: false },
  { label: "Lift is in service", attribute: "liftInService", value: true },
  { label: "Lift is out of service", attribute: "liftInService", value: false }
];

export function ReportScreen() {
  const intake = useRef(new ReportIntake()).current;
  const pseudonym = useRef(`pseud-${bytesToHex(randomBytes(8))}`).current; // rotating pseudonym for rate limiting; not a key and not an account id
  const [choice, setChoice] = useState(0);
  const [note, setNote] = useState("");
  const [photo, setPhoto] = useState<string | null>(null);
  const [status, setStatus] = useState("");

  return (
    <ScrollView style={s.screen}>
      <SyntheticBanner />
      <Text style={s.h1} accessibilityRole="header">Report an observation</Text>
      <Text style={s.muted}>Reports are public once a moderator approves them. Do not include your name, home, health or contact details. This build validates reports on the device only; there is no server.</Text>
      {OPTIONS.map((o, i) => <Button key={o.label} label={o.label} selected={i === choice} onPress={() => setChoice(i)} />)}
      <Text style={s.p}>Note (optional, 500 characters)</Text>
      <TextInput style={s.input} multiline value={note} onChangeText={setNote} maxLength={500} accessibilityLabel="Note" />
      <Button
        label={photo ? "Photo ready (metadata removed). Choose another" : "Add a photo (metadata is removed)"}
        hint="Avoid including people's faces"
        onPress={async () => {
          try {
            const p = await pickAndSanitisePhoto();
            if (p) setPhoto(p.uri);
          } catch {
            setStatus("That photo could not be made safe to share, so it was not added.");
          }
        }}
      />
      <Button
        label="Check report"
        onPress={() => {
          const o = OPTIONS[choice]!;
          const r = intake.submit(
            { reporterRef: pseudonym, venueId: "fictional-hall", segmentId: "entrance-side", attribute: o.attribute, value: o.value, observedAt: new Date().toISOString(), ...(note ? { note } : {}) },
            Date.now()
          );
          setStatus(
            r.status === "rejected"
              ? `Not accepted: ${r.reason}.`
              : r.flags.length > 0
                ? `Held for moderation. Possible personal details in your note (${r.flags.join(", ")}); please edit it.`
                : "Valid. It would now wait for a moderator. Reports never count as verified."
          );
        }}
      />
      {status !== "" && <Text style={s.p} accessibilityLiveRegion="polite">{status}</Text>}
    </ScrollView>
  );
}
