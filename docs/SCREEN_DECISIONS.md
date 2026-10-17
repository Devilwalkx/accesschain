# Screen decisions

AccessChain is written for people who may be older, tired, or in a hurry, and who need a yes/no/unknown answer about a real journey. Every screen below answers: why was it opened, what is shown first, the one main action, what happens next, and what it does when information or the connection is missing. Rules that apply everywhere: one clear purpose per screen, a labelled **Back** button (and the system Back) on every screen except Home, 18 sp body text and 56 dp touch targets (larger than the other apps), status always as an icon **and** words, light and dark, text size Normal/Large/Extra large on top of the phone's own setting.

## Home
- **Why opened:** start, or return to, a journey check.
- **First information:** the app name, one sentence ("Find out if you can get there, before you set off."), and one big primary button: "Tell us what you need" the first time, "Plan a journey" afterwards.
- **Primary action:** the big button. Secondary: "My needs", then smaller buttons for "Tell us about a problem", "Privacy and help", "Settings", then a text-size choice.
- **Next:** needs (first time) or the journey flow.
- **If something is missing:** if the saved answers cannot be opened (lost key) it says so in words and says they cannot be recovered, and offers the questions again. The demonstration banner is shown only if the person chose demonstration mode.

## What do you need? (Your needs)
- **Why opened:** to say, once, which barriers matter (steps, lifts, help at the door, toilet, walking distance, doorway width, rest gaps).
- **First information:** four big Yes/No rows with the state written in words; optional numbers hidden behind one button.
- **Primary action:** "Save and see my routes".
- **Next:** goes straight to the journey flow. Nothing is stored until Save; the answers are encrypted on the phone.
- **If something is missing:** invalid numbers give a plain message and keep what was typed. Unsaved edits are not kept if the app is killed (by design: nothing is written in the clear).

## Plan a journey: choice of information (first time only)
- **Why opened:** nothing is requested from the internet before the person agrees.
- **First information:** which two services are asked and what they can see; that needs never leave the phone.
- **Primary action:** "Yes, use live information". Equal-weight alternative: "No, use the demonstration instead" (made-up places, labelled on every screen).
- **If something is missing:** can be changed later in Privacy and help.

## Plan a journey: where to?
- **Why opened:** pick the place. **First information:** the question and a short honest limit ("10 places near the South Bank"). **Action:** one button per place. **Next:** where to start from.
- **If missing:** n/a (a fixed list; nothing is searched while typing).

## Plan a journey: where from?
- **Why opened:** pick the start. **First information:** five station buttons. Below: a postcode box ("Somewhere else") and "Where I am now" with its explanation shown **before** the phone asks for permission.
- **Primary action:** a station. **Next:** the result.
- **If something is missing:** a bad postcode is refused on the phone with an example; location refused says so and offers station or postcode; location refused with "don't ask again" adds a button that opens the phone's settings; location switched off or no signal has its own message. Back returns one step at a time (result, start, place, Home).

## Result (a journey to a place)
- **Why opened:** to decide whether to go, and what to check first.
- **First information, in this order:** the place and start; the person's own needs as chips ("Checked against your needs: No steps, Lifts are fine, Walk up to 400 m"); a loading line while it checks; any whole-trip notices; the place note; then each route as its own block: the route title (for example "Tube + walk about 560 m (25 min)"), one status chip in words, and one sentence explaining it ("1 of 2 parts confirmed. Not confirmed: Final approach.").
- **Then, for every route, four separate parts:** Transport, Transfers, Final approach, Correct entrance. Each has a status chip, the legs of the journey in plain words, "What we know", "What is missing", "How old the information is" and "What you can do".
- **What you can do** is built only from data that is really present: a link to the place's OpenStreetMap page, a phone number or website that OpenStreetMap lists for the place (shown as "listed on OpenStreetMap, not checked by us"), "compare with route N" where that route's evidence for the same part is better, or "check again before you leave". If OpenStreetMap lists no contact, the screen says exactly that. It never invents a number, a pavement, a crossing or an alternative route, and never treats a walking distance as proof that a walk is step-free.
- **Evidence one tap away:** turn-by-turn directions from TfL and "Read this route as plain text" (the whole result as one text, in reading order).
- **Primary action:** read, then act on "What you can do". Secondary: "Check again", "Change where I start", "Choose a different place".
- **If something is missing (each service separately):** a card "What answered" says for OpenStreetMap, the TfL journey planner and the TfL lift list whether each answered (and how long ago), was too slow, had no answer, or returned an error. If OpenStreetMap fails, nothing can be planned and the screen says so; if TfL fails, the place note still shows; if only the lift list fails, the journey still shows with the lifts marked "could not be checked". A result older than 15 minutes says it no longer counts as checked. "Check again" cannot be tapped while a check is running, and an identical request already running is shared, so it cannot send duplicates. If no step-free route exists TfL's answer is shown as exactly that.

## Plan a journey: demonstration
- Same layout and wording as the live result, with a persistent "Demonstration" banner, made-up places and no contact details. Demonstration controls ("Pretend 45 minutes have passed") are tucked into one collapsed section and labelled.

## Tell us about a problem
- **Why opened:** to say what was seen at a place. **First information:** a banner "Not built yet: reports cannot be sent. This screen only checks your report on the phone." **Action:** choose one of four options, optionally add a note or photo, "Check my report". **Next:** a plain result (held back because the note may contain personal details, or "checked on this phone, nothing was sent").
- **If missing:** photo that cannot be cleaned of metadata is refused with a message.

## Privacy and help
- **Why opened:** to understand what leaves the phone and to delete things. **First information:** what stays on the phone; **Live information** (what is sent to whom, and a switch); **If you lose this phone** (answers cannot be restored, there is no recovery code, the questions are asked again); where the information comes from, with attribution and a link to the OpenStreetMap licence; **Delete everything** with a confirmation that says "This can't be undone".

## Settings
- **Why opened:** change colours or text size, find out which build this is. **First information:** Colours (same as phone / light / dark), Text size (three sizes), the information source, and "About this build" (version, build number, application id, commit, build time, and the fact that it is a test build signed with the public Android test key).
