import React, { useRef, useState } from "react";
import { ScrollView, Text, TextInput } from "react-native";
import { bytesToHex, randomBytes } from "@noble/ciphers/utils.js";
import { ReportIntake, type AttributeKey } from "@accesschain/core";
import { pickAndSanitisePhoto } from "../photo";
import { BackBar, Button, SyntheticBanner } from "../ui";
import { useS } from "../settings";

const OPTIONS: Array<{ label: string; attribute: AttributeKey; value: boolean }> = [
  { label: "The entrance has no steps", attribute: "stepFree", value: true },
  { label: "The entrance has steps", attribute: "stepFree", value: false },
  { label: "The lift is working", attribute: "liftInService", value: true },
  { label: "The lift is not working", attribute: "liftInService", value: false }
];

export function ReportScreen({ onHome }: { onHome: () => void }) {
  const s = useS();
  const intake = useRef(new ReportIntake()).current;
  const pseudonym = useRef(`pseud-${bytesToHex(randomBytes(8))}`).current; // rotating pseudonym for rate limiting; not a key and not an account id
  const [choice, setChoice] = useState(0);
  const [more, setMore] = useState(false);
  const [note, setNote] = useState("");
  const [photo, setPhoto] = useState<string | null>(null);
  const [status, setStatus] = useState("");

  return (
    <ScrollView style={s.screen} contentContainerStyle={s.content} accessibilityLabel="Tell us about a problem">
      <BackBar onHome={onHome} />
      <SyntheticBanner text="Practice only. Nothing is sent from this app." />
      <Text style={s.h1} accessibilityRole="header">What did you see?</Text>
      <Text style={s.p}>Pick the closest one. Please don't include your name, address, health or phone number.</Text>
      {OPTIONS.map((o, i) => <Button key={o.label} label={o.label} selected={i === choice} onPress={() => setChoice(i)} />)}

      <Button label={more ? "Hide extras" : "Add a note or photo (optional)"} expanded={more} onPress={() => setMore(!more)} />
      {more && (
        <>
          <Text style={s.p}>Your note</Text>
          <TextInput style={s.input} multiline value={note} onChangeText={setNote} maxLength={500} accessibilityLabel="Your note" />
          <Button
            label={photo ? "Photo added. Choose a different one" : "Add a photo"}
            hint="Please avoid showing people's faces. Hidden information in the photo is removed."
            onPress={async () => {
              try {
                const p = await pickAndSanitisePhoto();
                if (p) setPhoto(p.uri);
              } catch {
                setStatus("We couldn't make that photo safe to share, so it was not added.");
              }
            }}
          />
        </>
      )}

      <Button
        variant="primary"
        label="Check my report"
        onPress={() => {
          const o = OPTIONS[choice]!;
          const r = intake.submit(
            { reporterRef: pseudonym, venueId: "fictional-hall", segmentId: "entrance-side", attribute: o.attribute, value: o.value, observedAt: new Date().toISOString(), ...(note ? { note } : {}) },
            Date.now()
          );
          setStatus(
            r.status === "rejected"
              ? `We couldn't accept that: ${r.reason}.`
              : r.flags.length > 0
                ? `Held back for a person to check. Your note may contain personal details (${r.flags.join(", ")}). Please edit it.`
                : "Thank you. This is a demonstration, so nothing was sent. A real report would be checked by a person first."
          );
        }}
      />
      {status !== "" && <Text style={s.p} accessibilityLiveRegion="polite" accessibilityRole="alert">{status}</Text>}
    </ScrollView>
  );
}
