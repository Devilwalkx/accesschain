# Getting AccessChain on your phone (no GitHub experience needed)

**What this is:** a test version of AccessChain. Everything in it is **made-up demonstration data** (a fictional station and a fictional hall). It shows how the app decides "this route suits you", "this route doesn't", or "we don't know yet". It is **not** real access information. Do not use it to plan a real journey.

You only need a phone and a GitHub login. You never have to use code, a command line or Git.

---

## Part 1: Install on an Android phone

1. **On your phone**, open the browser (Chrome) and go to:
   **https://github.com/Devilwalkx/accesschain/releases/tag/latest-test-build**
2. If GitHub asks you to **sign in**, sign in with the Devilwalkx account. (The project is private, so only you can see it.)
3. Scroll down to the **Assets** section. Tap **AccessChain-test.apk**. The file downloads.
   - If Chrome says *"This type of file can harm your device"*, tap **Download anyway**. It is a test build that is not from the Play Store.
4. When the download finishes, tap **Open** (or open your **Downloads** folder and tap the file).
5. Android may say **"For your security, your phone isn't allowed to install unknown apps from this source."**
   Tap **Settings**, switch on **Allow from this source**, press the back arrow, then tap **Install**.
6. If **Play Protect** warns *"App not scanned / unrecognised developer"*, tap **Install anyway**. This is expected: the test build is signed with a development key.
7. Tap **Open**. You should see a yellow box saying **"Synthetic demonstration data"**.

> I have not been able to run the app on a real phone myself, so you are the first person to try the installation. If any step looks different on your phone, tell me which step and send a screenshot.

## Part 2: Use the app (about two minutes)

The app is designed to be calm and simple: one thing at a time, big buttons, plain words. You can't get lost: every screen has a big **‹ Back to home** button at the top (and the phone's own back button also goes Home).

1. On **Home**, tap **Tell us what you need**.
2. Tap anything that applies, for example **I can't manage steps**. Each line shows ☑ Yes or ☐ No. For a walking limit, tap **Walking and doorway details** and type a number of metres. Then tap **Save and see my routes**.
3. The app asks **Use live information?** Read it, then choose:
   - **Yes, use live information**: the app asks TfL (Transport for London) and OpenStreetMap about real places and routes. They can see your internet address, and the place you're going. **Your needs are never sent.**
   - **No, use the demonstration instead**: made-up places only, nothing leaves your phone.
4. With live information: pick a place (for example **Tate Modern**), then pick the nearest station (or **Where I am now**; your location is rounded to about 100 metres first).
5. You will see:
   - **About the place**: what OpenStreetMap contributors have written about its accessibility, **and how old that note is**. It is written by the public and has not been checked by us.
   - One or more routes, each with an honest answer:
     - **✔ Suits your needs**: everything you asked for was checked and is fine.
     - **✖ Does not suit your needs**: a real problem was found (for example the walk is longer than you said you can manage).
     - **? We can't be sure yet**: something could not be checked. The card says what *was* checked and what *wasn't*. Today this usually means **the pavement between the station and the place**, because nobody publishes that. Please phone the venue.
   - Tap **What was checked?** for the ✔ ✖ ? list, and **Show the directions** for TfL's turn-by-turn steps.
6. Want everything bigger? On Home, under **Text size**, choose **Large text** or **Extra large text**.
7. **Privacy and help**: switch between live and demonstration information, see where the information comes from, make a **recovery code**, or **delete everything** from the phone (it asks first).

**Good to know:** the live information is real, but it is not a guarantee. TfL's route planner is asked for step-free routes; lift problems come from TfL's own list of broken lifts (so "no problem reported" is not the same as "checked working"); venue notes come from volunteers and may be years old. If something is missing, too old or disputed, the app says "We can't be sure yet" and never guesses.

## Part 3: Getting a newer version

When I make changes, I publish them and GitHub automatically builds a new file (it takes about 10 minutes). The same link in Part 1 always has the newest one. Download and install it again; it should replace the old version. If Android refuses, uninstall the old app first (this also deletes your saved needs, which is harmless in this test).

## Part 4: iPhone

There is **no iPhone app yet**. Installing on iPhone needs an Apple Developer account (paid) and signing, which has not been set up. There is a **web version** that works in the iPhone's Safari, but it needs to be put on a public web address first, and I have **not** done that without asking you, because it would make the demo visible to anyone. If you want it, tell me and I will explain the options (including cost and privacy).

## Part 5: If something goes wrong

| Problem | What to do |
|---|---|
| Link shows "404" or "Page not found" | You are not signed in to GitHub. Sign in, then use the link again. |
| No **Releases** / no **Assets** | The first build may still be running (about 10 minutes after my last update). Try again later. |
| "App not installed" | Uninstall any older AccessChain, then install again. |
| App opens then closes | Tell me your phone model and Android version and what you saw. |
| Screen says **"Cannot start safely"** | Your device did not provide a secure source of random numbers or secure storage. The app refuses to continue on purpose. Tell me your phone model. |
| You lose the phone / uninstall | Saved needs are gone unless you made a recovery secret and have it written down. |

## GitHub words in plain English

- **Repository (repo):** the project's folder on GitHub: `Devilwalkx/accesschain`.
- **Release:** a labelled download attached to the project. This is where the `.apk` lives.
- **Actions:** GitHub's built-in robot. It runs the tests and builds the app each time I publish a change. You don't need to open it, but you can see ticks/crosses there.
- **Branch:** a version line of the project. `main` is the official one. I also keep working copies on a branch called `claude/h-gm8m50`.

You do **not** need to press any buttons on GitHub other than downloading the file.
