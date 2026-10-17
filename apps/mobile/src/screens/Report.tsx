import React, { useRef, useState } from "react";
import { View } from "react-native";
import { bytesToHex, randomBytes } from "@noble/ciphers/utils.js";
import { ReportIntake, type AttributeKey } from "@accesschain/core";
import { pickAndSanitisePhoto } from "../photo";
import { Btn, Collapsible, DemoStrip, Field, Notice, Txt } from "../ui";

const OPTIONS: Array<{ label: string; attribute: AttributeKey; value: boolean }> = [
  { label: "The entrance has no steps", attribute: "stepFree", value: true },
  { label: "The entrance has steps", attribute: "stepFree", value: false },
  { label: "The lift is working", attribute: "liftInService", value: true },
  { label: "The lift is not working", attribute: "liftInService", value: false }
];

export function ReportScreen() {
  const intake = useRef(new ReportIntake()).current;
  const pseudonym = useRef(`pseud-${bytesToHex(randomBytes(8))}`).current; // rotating pseudonym for rate limiting; not a key and not an account id
  const [choice, setChoice] = useState(0);
  const [note, setNote] = useState("");
  const [photo, setPhoto] = useState<string | null>(null);
  const [status, setStatus] = useState<null | { tone: "ok" | "wait" | "bad"; text: string }>(null);

  return (
    <View>
      <DemoStrip text="Not built yet: reports cannot be sent. This screen only checks your report on the phone. Nothing leaves it." />
      <Txt v="title" header>What did you see?</Txt>
      <Txt>Pick the closest one. Please don't include your name, address, health or phone number.</Txt>
      <View accessibilityRole="radiogroup" accessibilityLabel="What did you see?">
        {OPTIONS.map((o, i) => <Btn key={o.label} role="radio" kind="secondary" label={o.label} selected={i === choice} onPress={() => setChoice(i)} />)}
      </View>

      <Collapsible title="Add a note or photo (optional)">
        <Field label="Your note" multiline value={note} onChange={(t) => setNote(t.slice(0, 500))} />
        <Btn
          kind="secondary"
          label={photo ? "Photo added. Choose a different one" : "Add a photo"}
          hint="Please avoid showing people's faces. Hidden information in the photo is removed."
          onPress={async () => {
            try {
              const p = await pickAndSanitisePhoto();
              if (p) setPhoto(p.uri);
            } catch {
              setStatus({ tone: "bad", text: "We couldn't make that photo safe to share, so it was not added." });
            }
          }}
        />
      </Collapsible>

      <Btn
        label="Check my report"
        onPress={() => {
          const o = OPTIONS[choice]!;
          const r = intake.submit(
            { reporterRef: pseudonym, venueId: "fictional-hall", segmentId: "entrance-side", attribute: o.attribute, value: o.value, observedAt: new Date().toISOString(), ...(note ? { note } : {}) },
            Date.now()
          );
          setStatus(
            r.status === "rejected"
              ? { tone: "bad", text: `We couldn't accept that: ${r.reason}.` }
              : r.flags.length > 0
                ? { tone: "wait", text: `Held back for a person to check. Your note may contain personal details (${r.flags.join(", ")}). Please edit it.` }
                : { tone: "ok", text: "Checked on this phone. This is a demonstration, so nothing was sent. A real report would be checked by a person first." }
          );
        }}
      />
      {status && <Notice tone={status.tone} text={status.text} />}
    </View>
  );
}
