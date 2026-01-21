# AGENTS Instructions

Goal
- Replace the single valid identifier with the 9 valid identifiers: 2027, 2028, 2029, 2030, 2031, 2032, 2033, 2034, 2035.
- Each valid identifier is single-use. After a roulette play (win or lose), reusing the same identifier must be treated as invalid and behave exactly like an invalid input (show the same error message, no roulette screen).

Scope (likely files)
- Backend: `/app/backend/main.py` (valid code list, DB seeding, /api/play logic)
- Frontend: `/app/frontend/app.js` (client-side validation and flow)
- Docs/tests: `/app/README.md`, `/app/docs/spec/demo-scenario.md`, `/app/docs/spec/test-plan.md`

Implementation guidance
1) Backend validation and single-use behavior
- Replace `VALID_CODE` with an allow-list for 2027-2035.
- Seed `lid_codes` for each allowed code if missing. Do not reset used codes back to `new` on startup.
- If a code is not in the allow-list, return `status: "invalid"` and record an invalid attempt.
- If a code is in the allow-list but has already been used (any status other than `new`), return `status: "invalid"` and record an invalid attempt.
- When a `new` code is played, mark it as used (win or lose). Do not allow re-display of coupons on subsequent attempts.
- Keep the invalid message aligned with the frontend invalid-input message (currently "無効な番号です").

2) Frontend behavior
- Update the client-side allow-list to 2027-2035 (or remove the single-code check) so valid codes pass initial validation.
- If the backend returns `status: "invalid"`, show the input error message and stay on the input screen (same behavior as an invalid code entry).
- Only show the roulette screen for `win` / `lose` responses.

3) Docs/tests
- Update demo specs and test plan to reflect the new valid codes and the single-use rule.

Acceptance criteria
- Only 2027-2035 are accepted as valid identifiers.
- First play with any valid identifier behaves normally (win/lose).
- Second play with the same identifier shows the same invalid-input error and does not show the roulette screen.
- Invalid codes (e.g., 0000) still show the invalid-input error.

Suggested manual checks
- Play 2027 once, then again; second attempt is invalid (no roulette).
- Play 2035 once, then again; second attempt is invalid (no roulette).
- Enter an invalid code (0000) and confirm the error message matches the reused-code error.
