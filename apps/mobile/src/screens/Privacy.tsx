import React, { useState } from "react";
import { Linking, Platform, View } from "react-native";
import { ATTRIBUTION } from "@accesschain/core";
import { useApp } from "../store";
import { useLive } from "../live";
import { useTheme } from "../design/theme";
import { Btn, Card, ConfirmCard, Notice, Txt } from "../ui";

export function PrivacyScreen() {
  const app = useApp();
  const c = useTheme();
  const { mode, setMode } = useLive();
  const [asking, setAsking] = useState(false);
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const web = Platform.OS === "web";

  return (
    <View>
      <Txt v="title" header>Privacy and help</Txt>
      <Txt>What you tell us about your needs stays on this phone, locked with a key only this phone holds. We can't read it.</Txt>
      {web && <Notice tone="wait" text="You are using the web version. Web browsers protect the key less well than the phone app, and clearing your browser data deletes it for good." />}

      <Txt v="heading" header>Live information</Txt>
      <Card>
        <Txt>
          {mode === "live"
            ? "Live information is on. The app asks TfL for routes and lift news (your start station, rough location or typed postcode, and the place's position) and OpenStreetMap for the place's name and notes. They can see your internet address. Your needs are never sent. These lookups are not encrypted with the app's own key: they travel over HTTPS, and TfL and OpenStreetMap can read them."
            : "Live information is off. Nothing leaves your phone. The demonstration places are made up."}
        </Txt>
        {mode === "live" ? (
          <Btn kind="secondary" label="Switch to the demonstration places" onPress={() => setMode("demo")} />
        ) : (
          <Btn kind="secondary" label="Use live information (contacts TfL and OpenStreetMap)" onPress={() => setMode("live")} />
        )}
      </Card>

      <Txt v="heading" header>If you lose this phone</Txt>
      <Card>
        <Txt>Your answers cannot be restored. They are not copied anywhere and there is no recovery code, so a new phone starts empty and you answer the questions again. It takes about a minute.</Txt>
      </Card>

      <Txt v="heading" header>Where the information comes from</Txt>
      <Card>
        {ATTRIBUTION.map((a) => <Txt key={a}>{a}</Txt>)}
        <Txt>Notes written by the public have not been checked by us and can be wrong or out of date. Always confirm with the venue.</Txt>
        <Btn kind="secondary" icon="open" label="OpenStreetMap copyright and licence" hint="Opens in your browser" onPress={() => { Linking.openURL("https://www.openstreetmap.org/copyright").catch(() => undefined); }} />
      </Card>

      <Txt v="heading" header>Delete everything</Txt>
      <Btn kind="danger" label="Delete my answers from this phone" onPress={() => setAsking(true)} />
      {msg !== "" && <Notice tone="ok" text={msg} />}
      <Txt v="small" color={c.textMuted}>This removes your answers and the key from this phone.</Txt>
      {asking && (
        <ConfirmCard
          danger
          title="Delete your needs and your key from this phone?"
          body="This can't be undone."
          yes="Yes, delete everything"
          no="No, keep it"
          onNo={() => setAsking(false)}
          onYes={async () => {
            if (busy) return;
            setBusy(true);
            try {
              await app.eraseProfile();
              setMsg("Deleted from this phone. Copies you saved elsewhere are not affected.");
            } catch {
              setMsg("We couldn't delete everything. Please try again.");
            }
            setBusy(false);
            setAsking(false);
          }}
        />
      )}
    </View>
  );
}
