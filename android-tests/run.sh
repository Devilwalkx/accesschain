#!/usr/bin/env bash
# Runs inside the Android emulator job. Everything it measures is written to $OUT; nothing here is a claim by itself.
set -u
PKG=app.devilwalkx.accesschain
PREV_APK=${PREV_APK:-}
APK=${APK:?path to apk}
OUT=${OUT:-out}
FONT=${FONT:-1.0}
NIGHT=${NIGHT:-no}
mkdir -p "$OUT/shots" "$OUT/junit" "$OUT/hierarchy"
FAIL=0
log() { echo "== $*" | tee -a "$OUT/log.txt"; }

adb wait-for-device
adb shell getprop ro.build.version.release > "$OUT/device.txt"
{ echo -n "sdk="; adb shell getprop ro.build.version.sdk; echo -n "model="; adb shell getprop ro.product.model; echo -n "abi="; adb shell getprop ro.product.cpu.abi; echo -n "size="; adb shell wm size; echo -n "density="; adb shell wm density; echo "font_scale=$FONT night=$NIGHT"; } | tr -d '\r' >> "$OUT/device.txt"

# connectivity of the emulator (live flows need internet; results are recorded, not assumed)
{ echo -n "ping: "; adb shell "ping -c 1 -W 3 api.tfl.gov.uk" 2>&1 | tail -2 | tr '\n' ' '; echo; } | tr -d '\r' > "$OUT/network.txt"

# upgrade check: install the previous published APK only if it has the same application id, then install this one over it
log "upgrade check"
if [ -n "$PREV_APK" ] && [ -f "$PREV_APK" ]; then
  adb install -r "$PREV_APK" > "$OUT/prev-install.txt" 2>&1 || true
  if adb shell pm list packages | tr -d '\r' | grep -qx "package:$PKG"; then
    adb install -r "$APK" > "$OUT/upgrade-install.txt" 2>&1 && echo "UPGRADE: installed over previous release: $(cat "$OUT/upgrade-install.txt" | tr '\n' ' ')" > "$OUT/upgrade.txt" || echo "UPGRADE: FAILED: $(cat "$OUT/upgrade-install.txt" | tr '\n' ' ')" > "$OUT/upgrade.txt"
    adb shell monkey -p $PKG -c android.intent.category.LAUNCHER 1 >/dev/null 2>&1; sleep 6
    adb exec-out screencap -p > "$OUT/shots/upgrade-after.png"
    adb shell am force-stop $PKG
    adb uninstall $PKG >/dev/null 2>&1
  else
    echo "UPGRADE: NOT TESTED. The previous published APK does not have application id $PKG (install said: $(tr '\n' ' ' < "$OUT/prev-install.txt"))." > "$OUT/upgrade.txt"
  fi
else
  echo "UPGRADE: NOT TESTED. No previous APK was available." > "$OUT/upgrade.txt"
fi
cat "$OUT/upgrade.txt" | tee -a "$OUT/log.txt"

log "install"
adb install -r "$APK" 2>&1 | tee -a "$OUT/log.txt"
adb shell dumpsys package $PKG | grep -E "versionName|versionCode|requested permissions|android.permission|granted=" | tr -d '\r' > "$OUT/package.txt"
adb shell settings put system font_scale "$FONT"
adb shell cmd uimode night "$NIGHT"
adb shell settings put global window_animation_scale 0
adb shell settings put global transition_animation_scale 0
adb shell settings put global animator_duration_scale 0

# baseline evidence that does not depend on Maestro: launch, screenshot, accessibility hierarchy
log "baseline launch"
adb shell monkey -p $PKG -c android.intent.category.LAUNCHER 1 >/dev/null 2>&1
sleep 8
adb exec-out screencap -p > "$OUT/shots/00-launch.png"
adb shell uiautomator dump /sdcard/launch.xml >/dev/null 2>&1 && adb pull /sdcard/launch.xml "$OUT/hierarchy/launch.xml" >/dev/null 2>&1
adb shell am force-stop $PKG

# ---- accessibility-tree audit of the screen each flow ends on (NOT a TalkBack run) and a TalkBack availability probe
a11y_audit() {
  local label="$1"
  adb shell uiautomator dump /sdcard/a11y.xml >/dev/null 2>&1 && adb pull /sdcard/a11y.xml "$OUT/hierarchy/$label.xml" >/dev/null 2>&1 || { echo "{\"screen\":\"$label\",\"error\":\"dump failed\"}" >> "$OUT/a11y-tree.jsonl"; return; }
  local dpi; dpi=$(adb shell wm density | tr -d '\r' | grep -oE '[0-9]+' | tail -1)
  python3 android-tests/a11y-tree-audit.py "$OUT/hierarchy/$label.xml" "${dpi:-420}" "$label" >> "$OUT/a11y-tree.jsonl" 2>>"$OUT/log.txt" || true
}
{ echo "packages matching talkback/accessibility on this emulator image:"; adb shell pm list packages 2>/dev/null | tr -d '\r' | grep -iE "talkback|marvin|accessibility" || echo "(none)"; } > "$OUT/talkback-probe.txt"

run_flow() {
  local f=$1
  log "flow $f"
  ( cd "$OUT/shots" && timeout 420 maestro test --no-ansi --format junit --output "../junit/$(basename "$f" .yaml).xml" --test-output-dir "$OUT/maestro/$(basename "$f" .yaml)" "$GITHUB_WORKSPACE/android-tests/flows/$f" ) 2>&1 | tail -40 | tee -a "$OUT/log.txt"
  local rc=${PIPESTATUS[0]}
  adb exec-out screencap -p > "$OUT/shots/end-of-$(basename "$f" .yaml).png" 2>/dev/null
  a11y_audit "$(basename "$f" .yaml)"
  if [ "$rc" != "0" ]; then FAIL=1; log "FLOW FAILED: $f"; adb exec-out screencap -p > "$OUT/shots/FAILED-$(basename "$f" .yaml).png"; fi
  return $rc
}
# informational flows touch the real internet or the permission dialog: their result is recorded but never fails the job
run_info_flow() {
  local f=$1
  log "info flow $f"
  ( cd "$OUT/shots" && timeout 300 maestro test --no-ansi --format junit --output "../junit/$(basename "$f" .yaml).xml" --test-output-dir "$OUT/maestro/$(basename "$f" .yaml)" "$GITHUB_WORKSPACE/android-tests/flows/$f" ) 2>&1 | tail -40 | tee -a "$OUT/log.txt"
  local rc=${PIPESTATUS[0]}
  echo "$f exit=$rc" >> "$OUT/informational-results.txt"
  adb exec-out screencap -p > "$OUT/shots/end-of-$(basename "$f" .yaml).png" 2>/dev/null
  a11y_audit "info-$(basename "$f" .yaml)"
  if [ "$rc" != "0" ]; then log "INFORMATIONAL FLOW DID NOT PASS: $f"; adb exec-out screencap -p > "$OUT/shots/INFO-FAILED-$(basename "$f" .yaml).png"; fi
  adb shell uiautomator dump /sdcard/after.xml >/dev/null 2>&1 && adb pull /sdcard/after.xml "$OUT/hierarchy/after-$(basename "$f" .yaml).xml" >/dev/null 2>&1
}

# whole-session screen recording of the main task (the recorder stops at 170 s per file)
adb shell "screenrecord --time-limit 170 /sdcard/main-task.mp4" &
REC=$!
sleep 2
run_flow 02-main-task-demo.yaml
adb shell pkill -2 screenrecord; wait $REC 2>/dev/null; sleep 2
adb pull /sdcard/main-task.mp4 "$OUT/main-task.mp4" >/dev/null 2>&1 || log "no recording"

for f in 01-first-run.yaml 04-back-navigation.yaml 05-keyboard-needs.yaml 06-settings-display.yaml 15-encryption-check.yaml; do run_flow $f; done

# live journey against the REAL services (content varies; recorded, never asserted). The final screen text is kept as evidence of what came back.
run_info_flow 03-live-journey.yaml
adb shell uiautomator dump /sdcard/live.xml >/dev/null 2>&1 && adb pull /sdcard/live.xml "$OUT/hierarchy/live-result.xml" >/dev/null 2>&1
python3 - "$OUT/hierarchy/live-result.xml" > "$OUT/live-result-text.txt" 2>/dev/null <<'PY' || true
import re,sys
x=open(sys.argv[1],encoding="utf8",errors="replace").read()
for t in re.findall(r'text="([^"]+)"',x):
    print(t)
PY

# location permission refused and marked "don't ask again" (revoked with the user-fixed flag, as Android does after a permanent denial); the manual start must still work
log "location permission permanently denied"
adb shell pm clear $PKG >/dev/null 2>&1
adb shell pm revoke $PKG android.permission.ACCESS_COARSE_LOCATION >/dev/null 2>&1
adb shell pm set-permission-flags $PKG android.permission.ACCESS_COARSE_LOCATION user-set user-fixed >/dev/null 2>&1
adb shell dumpsys package $PKG | grep -E "ACCESS_COARSE_LOCATION" | tr -d '\r' > "$OUT/location-permission-state.txt"
run_info_flow 07-location-denied.yaml

# offline: the live flow with no network must end in clear notices, not a blank or stuck screen
log "offline live flow"
adb shell cmd connectivity airplane-mode enable >/dev/null 2>&1 || { adb shell svc wifi disable; adb shell svc data disable; }
sleep 4
adb shell "ping -c 1 -W 2 api.tfl.gov.uk" > "$OUT/network-offline.txt" 2>&1 || true
run_info_flow 11-offline-live.yaml
adb exec-out screencap -p > "$OUT/shots/60-offline-live.png"
adb shell cmd connectivity airplane-mode disable >/dev/null 2>&1 || { adb shell svc wifi enable; adb shell svc data enable; }
sleep 4

# process death: needs are saved, the app goes to the background, the OS kills the process, then it is relaunched
run_flow 08-profile-survives-kill-write.yaml
sleep 2
adb shell am kill $PKG
sleep 1
adb shell pidof $PKG > "$OUT/pid-after-kill.txt" || echo "process gone" > "$OUT/pid-after-kill.txt"
# ---- signing consequence: an APK with the same package id but a DIFFERENT signing key must be refused by Android and must not touch the installed app's data.
# The key is a throw-away created for this check only; it is deleted straight away and is not a release key.
log "signing consequence check (throw-away key)"
BT=$(ls -d "${ANDROID_HOME:-${ANDROID_SDK_ROOT:-/usr/local/lib/android/sdk}}"/build-tools/* 2>/dev/null | sort -V | tail -1)
if [ -n "$BT" ] && command -v keytool >/dev/null; then
  keytool -genkeypair -keystore "$OUT/throwaway.jks" -storepass throwaway -keypass throwaway -alias t -keyalg RSA -keysize 2048 -validity 2 -dname "CN=throwaway" >/dev/null 2>&1
  "$BT/apksigner" sign --ks "$OUT/throwaway.jks" --ks-pass pass:throwaway --out "$OUT/resigned.apk" "$APK" >/dev/null 2>&1
  adb install -r "$OUT/resigned.apk" > "$OUT/foreign-signature-install.txt" 2>&1 || true
  rm -f "$OUT/throwaway.jks" "$OUT/resigned.apk" "$OUT/resigned.apk.idsig"
  if grep -q "INSTALL_FAILED_UPDATE_INCOMPATIBLE" "$OUT/foreign-signature-install.txt"; then echo "PASS: Android refused to install a differently signed APK over the installed app (INSTALL_FAILED_UPDATE_INCOMPATIBLE). The next flow checks the app's data is intact." | tee "$OUT/signing-consequence.txt"; else echo "FAIL: unexpected result: $(cat "$OUT/foreign-signature-install.txt")" | tee "$OUT/signing-consequence.txt"; FAIL=1; fi
else
  echo "NOT TESTED: apksigner or keytool not found on this runner" | tee "$OUT/signing-consequence.txt"
fi
run_flow 09-profile-survives-kill-check.yaml

# rotation and relaunch
log "rotation"
adb shell settings put system accelerometer_rotation 0
adb shell settings put system user_rotation 1
adb shell monkey -p $PKG -c android.intent.category.LAUNCHER 1 >/dev/null 2>&1
sleep 3
adb exec-out screencap -p > "$OUT/shots/20-landscape.png"
adb shell settings put system user_rotation 0
sleep 1

# cold start time (release build), 5 runs
log "startup"
: > "$OUT/startup.txt"
for i in 1 2 3 4 5; do
  adb shell am force-stop $PKG; sleep 1
  adb shell am start -W -n "$(adb shell cmd package resolve-activity --brief $PKG | tail -1 | tr -d '\r')" | grep -E "TotalTime|WaitTime" | tr -d '\r' | tr '\n' ' ' >> "$OUT/startup.txt"; echo >> "$OUT/startup.txt"
  sleep 2
done

# memory + scrolling jank on the longest screen (the demonstration journey)
log "memory and scroll"
adb shell am force-stop $PKG
sleep 3
SAVE_FAIL=$FAIL
run_flow 10-open-long-screen.yaml || { FAIL=$SAVE_FAIL; log "retrying 10-open-long-screen once"; sleep 5; run_flow 10-open-long-screen.yaml; }
adb shell dumpsys gfxinfo $PKG reset >/dev/null
for i in 1 2 3 4 5 6; do adb shell input swipe 540 1700 540 500 250; adb shell input swipe 540 500 540 1700 250; done
adb shell dumpsys gfxinfo $PKG | grep -E "Total frames rendered|Janky frames|50th|90th|95th|99th" | tr -d '\r' > "$OUT/scroll-gfxinfo.txt"
adb shell dumpsys meminfo $PKG | grep -E "TOTAL PSS|TOTAL:|Java Heap|Native Heap" | tr -d '\r' | head -5 > "$OUT/meminfo.txt"

adb logcat -d -t 3000 | grep -E "ReactNative|AndroidRuntime|FATAL|$PKG" | tail -200 > "$OUT/logcat-excerpt.txt"
log "done fail=$FAIL"
exit $FAIL
