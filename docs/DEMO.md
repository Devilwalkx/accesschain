# AccessChain synthetic demo

> Synthetic demonstration data. Not real access information. "Example Road station" and "Fictional Hall" do not exist.

Requirements profile (held on-device in the real app, shown here because it is synthetic):

```json
{
  "avoidSteps": true,
  "maxWalkM": 400,
  "minClearWidthMm": 800,
  "needsAccessibleToilet": false,
  "liftAcceptable": true,
  "assistanceAcceptable": false
}
```

## 1. Main entrance (steps): a known barrier, though the station route is valid

Assessed at 2026-10-17T09:00:00.000Z. Result: **Known barrier**.

```text
Route route-main (via synthetic-router): Known barrier.
This is a summary of reported information, not a guarantee. Where it says insufficient evidence, the information is missing, expired or in conflict.
Step 1 of 3: Example Road station: lift from platform to street (arrival).
  Known fit for avoid steps: Reported step-free.
  Known fit for lift: Lift reported in service.
  Known fit for clear width: Clear width: 1100 mm meets your requirement.
  Source: stepFree reported by operator feed, observed 0 min ago, retrieved 0 min ago.
  Source: clearWidthMm reported by field verification, observed 0 min ago, retrieved 0 min ago.
  Source: liftInService reported by operator feed, observed 0 min ago, retrieved 0 min ago.
Step 2 of 3: Example Road pavement to Fictional Hall (kerb heights not checked) (approach).
  Insufficient evidence for avoid steps: No evidence for steps.
  Insufficient evidence for clear width: No evidence for Clear width.
  Source: walkLengthM reported by operator feed, observed 0 min ago, retrieved 0 min ago.
Step 3 of 3: Fictional Hall main entrance on Example Road (entrance).
  Known barrier for avoid steps: Reported to have steps.
  Known fit for clear width: Clear width: 1100 mm meets your requirement.
  Source: stepFree reported by field verification, observed 0 min ago, retrieved 0 min ago.
  Source: clearWidthMm reported by field verification, observed 0 min ago, retrieved 0 min ago.
Whole journey – Known fit for walking distance: Total walking 180 m is within your 400 m limit.
```

## 2. Side entrance, pavement not field-checked: insufficient evidence, not a pass

Assessed at 2026-10-17T09:00:00.000Z. Result: **Insufficient evidence**.

```text
Route route-side (via synthetic-router): Insufficient evidence.
This is a summary of reported information, not a guarantee. Where it says insufficient evidence, the information is missing, expired or in conflict.
Step 1 of 3: Example Road station: lift from platform to street (arrival).
  Known fit for avoid steps: Reported step-free.
  Known fit for lift: Lift reported in service.
  Known fit for clear width: Clear width: 1100 mm meets your requirement.
  Source: stepFree reported by operator feed, observed 0 min ago, retrieved 0 min ago.
  Source: clearWidthMm reported by field verification, observed 0 min ago, retrieved 0 min ago.
  Source: liftInService reported by operator feed, observed 0 min ago, retrieved 0 min ago.
Step 2 of 3: Example Road pavement to Fictional Hall (kerb heights not checked) (approach).
  Insufficient evidence for avoid steps: No evidence for steps.
  Insufficient evidence for clear width: No evidence for Clear width.
  Source: walkLengthM reported by operator feed, observed 0 min ago, retrieved 0 min ago.
Step 3 of 3: Fictional Hall side entrance on Mill Lane (entrance).
  Known fit for avoid steps: Reported step-free.
  Known fit for clear width: Clear width: 920 mm meets your requirement.
  Source: stepFree reported by venue report, observed 0 min ago, retrieved 0 min ago.
  Source: clearWidthMm reported by field verification, observed 0 min ago, retrieved 0 min ago.
  Source: accessibleToilet reported by venue report, observed 0 min ago, retrieved 0 min ago.
Whole journey – Known fit for walking distance: Total walking 180 m is within your 400 m limit.
```

## 3. After a paid tester field-checks the pavement: known fit

Assessed at 2026-10-17T09:00:00.000Z. Result: **Known fit**.

```text
Route route-side (via synthetic-router): Known fit.
This is a summary of reported information, not a guarantee. Where it says insufficient evidence, the information is missing, expired or in conflict.
Step 1 of 3: Example Road station: lift from platform to street (arrival).
  Known fit for avoid steps: Reported step-free.
  Known fit for lift: Lift reported in service.
  Known fit for clear width: Clear width: 1100 mm meets your requirement.
  Source: stepFree reported by operator feed, observed 0 min ago, retrieved 0 min ago.
  Source: clearWidthMm reported by field verification, observed 0 min ago, retrieved 0 min ago.
  Source: liftInService reported by operator feed, observed 0 min ago, retrieved 0 min ago.
Step 2 of 3: Example Road pavement to Fictional Hall (kerb heights not checked) (approach).
  Known fit for avoid steps: Reported step-free.
  Known fit for clear width: Clear width: 1400 mm meets your requirement.
  Source: walkLengthM reported by operator feed, observed 0 min ago, retrieved 0 min ago.
  Source: stepFree reported by field verification, observed 0 min ago, retrieved 0 min ago.
  Source: clearWidthMm reported by field verification, observed 0 min ago, retrieved 0 min ago.
  Source: restingPointSpacingM reported by field verification, observed 0 min ago, retrieved 0 min ago.
Step 3 of 3: Fictional Hall side entrance on Mill Lane (entrance).
  Known fit for avoid steps: Reported step-free.
  Known fit for clear width: Clear width: 920 mm meets your requirement.
  Source: stepFree reported by venue report, observed 0 min ago, retrieved 0 min ago.
  Source: clearWidthMm reported by field verification, observed 0 min ago, retrieved 0 min ago.
  Source: accessibleToilet reported by venue report, observed 0 min ago, retrieved 0 min ago.
Whole journey – Known fit for walking distance: Total walking 180 m is within your 400 m limit.
```

## 4. 45 minutes later the live lift feed has expired: back to insufficient evidence

Assessed at 2026-10-17T09:45:00.000Z. Result: **Insufficient evidence**.

```text
Route route-side (via synthetic-router): Insufficient evidence.
This is a summary of reported information, not a guarantee. Where it says insufficient evidence, the information is missing, expired or in conflict.
Step 1 of 3: Example Road station: lift from platform to street (arrival).
  Known fit for avoid steps: Reported step-free.
  Insufficient evidence for lift: Evidence for lift status has expired; treated as unknown.
  Known fit for clear width: Clear width: 1100 mm meets your requirement.
  Source: stepFree reported by operator feed, observed 45 min ago, retrieved 45 min ago.
  Source: clearWidthMm reported by field verification, observed 45 min ago, retrieved 45 min ago.
  Source: liftInService reported by operator feed, observed 45 min ago, retrieved 45 min ago (expired).
Step 2 of 3: Example Road pavement to Fictional Hall (kerb heights not checked) (approach).
  Known fit for avoid steps: Reported step-free.
  Known fit for clear width: Clear width: 1400 mm meets your requirement.
  Source: walkLengthM reported by operator feed, observed 45 min ago, retrieved 45 min ago.
  Source: stepFree reported by field verification, observed 45 min ago, retrieved 45 min ago.
  Source: clearWidthMm reported by field verification, observed 45 min ago, retrieved 45 min ago.
  Source: restingPointSpacingM reported by field verification, observed 45 min ago, retrieved 45 min ago.
Step 3 of 3: Fictional Hall side entrance on Mill Lane (entrance).
  Known fit for avoid steps: Reported step-free.
  Known fit for clear width: Clear width: 920 mm meets your requirement.
  Source: stepFree reported by venue report, observed 45 min ago, retrieved 45 min ago.
  Source: clearWidthMm reported by field verification, observed 45 min ago, retrieved 45 min ago.
  Source: accessibleToilet reported by venue report, observed 45 min ago, retrieved 45 min ago.
Whole journey – Known fit for walking distance: Total walking 180 m is within your 400 m limit.
```

### What changed since the itinerary was saved

- Worse than when saved: Known fit → Insufficient evidence.
- lift (arrive-station): Known fit → Insufficient evidence. Evidence for lift status has expired; treated as unknown.
- Evidence "liftInService" from synthetic-station-feed has expired since you saved this.

(The first saved itinerary was saved as: Insufficient evidence.)

The app never shows a cached "all clear": once the lift feed expires the segment is unknown until a fresh observation arrives.

