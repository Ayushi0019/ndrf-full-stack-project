# NDRF Portal Security Specification

## Data Invariants
1. A **Resource** must belong to a valid Disaster Zone (Sector).
2. A **Resource Request** must be tied to an authenticated requester and a specific location.
3. **Emergency Alerts** can only be broadcast by HQ Administrators.
4. **Inventory** levels can only be adjusted by HQ Administrators.
5. **Incident Evidence** (Photos) can be uploaded by any field member but only deleted by Admin.

## The "Dirty Dozen" (Red Team Payloads)
These payloads *must* be rejected by Firestore Security Rules.

1. **Identity Spoofing**: Attempt to create a Resource Request with someone else's `requesterId`.
2. **Privilege Escalation**: User attempts to update their own profile to `role: 'hq_admin'`.
3. **Ghost Fields**: Attempt to create a Resource with an unauthorized `isVerified: true` field.
4. **Orphaned Writes**: Creating a Resource Request for a non-existent Resource.
5. **PII Leak**: Non-admin attempting to list the entire `users` collection to scrape emails.
6. **State Shortcut**: Field member trying to mark a Request as `delivered` when it's still `pending`.
7. **Resource Poisoning**: Injecting a 2MB base64 string into a `caption` field.
8. **ID Poisoning**: Attempting to create a document with an ID like `../../secrets/config`.
9. **Timestamp Spoofing**: Sending a `createdAt` value from the future (client-side).
10. **Administrative Bypass**: Non-admin attempting to broadcast an `EmergencyAlert`.
11. **Inventory Manipulation**: Field member attempting to decrement inventory stock.
12. **Evidence Tampering**: User attempting to delete someone else's uploaded photo.

## Test Runner Logic (Mock Logic)
- `tests/identity.test.ts`: Verify `auth.uid` matches `requesterId`.
- `tests/rbac.test.ts`: Verify `isAdmin()` fails for anonymous users without the hq_admin flag.
- `tests/schema.test.ts`: Verify `isValid[Entity]` blocks extra keys.
