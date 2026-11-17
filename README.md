# Farmer Connect

The landing page runs on static hosting over HTTPS. The buyer and farmer forms send URL-encoded submissions to n8n. A form shows a reference only after n8n confirms that Google Sheets saved the submission. Google Sheets holds the private records and n8n sends emails through SMTP.

## Set up n8n

1. Create two private Google spreadsheets with one tab in each. Paste the tab-separated headers below into row 1. Keep headers unique, use contiguous rows, and give the n8n Google Sheets credential edit access to both documents.
2. Import [buyer-request.json](n8n/buyer-request.json), [farmer-registration.json](n8n/farmer-registration.json), and [notifications.json](n8n/notifications.json). Select the Google Sheets credential and replace the document ID placeholder in each Sheets node.
3. In **Email notifications**, select your SMTP credential and replace the sender address on each Send node. Set your review inbox in the **Prepare buyer alert** and **Prepare farmer alert** Code nodes.
4. Set **Allowed Origins** on both Webhook nodes to the exact origin hosting the page. The exports default to `https://eunicewairima.github.io`. If the n8n host or paths differ, edit the two form actions in `index.html`.
5. Test with n8n test URLs and disposable spreadsheets and inboxes. When ready, retire or update the old buyer webhook workflow before publishing the replacement, since it uses the same production path. Keep any existing buyer records in your existing spreadsheet or archive them before switching. Publish all three workflows.

Buyer spreadsheet tab **Requests**

```tsv
reference	buyerName	phone	location	dataConsent	email	notes	preferredDeliveryDate	items	produce	itemDetails	submittedAt	status	ownerAlertedAt	lastEmailedStatus
```

Farmer spreadsheet tab **Farmers**

```tsv
reference	farmerName	phone	location	dataConsent	items	produce	itemDetails	submittedAt	status	ownerAlertedAt
```

The workflows use n8n's [Webhook](https://docs.n8n.io/integrations/builtin/core-nodes/n8n-nodes-base.webhook/) and [Google Sheets operations](https://docs.n8n.io/integrations/builtin/app-nodes/n8n-nodes-base.googlesheets/sheet-operations/). Keep the Sheets write nodes set to **Let n8n format** so values such as phone numbers and notes are stored as literal data.

## Review requests and match supply

- Buyer requests start at **New**. Set a row to **Finding farmers**, **Offer sent**, or **Completed** as work progresses. Add those four options as a dropdown on the `status` column if desired.
- Farmer registrations start at **Pending review**. Call the farmer to confirm their details and current stock, then set their row to **Reviewed**. Use a sheet filter on `status`, `produce`, and `location` to find candidates. Use `itemDetails` to compare quantity and harvest date per crop against the buyer's quantity and preferred delivery date. Confirm remaining stock, price, and transport before offering it.
- Send the buyer the actual offer with farm name, quantity, price per kilogram, delivery cost, and proposed delivery date. Set **Offer sent** once sent. Mark **Completed** after delivery.
- Every ten minutes the notification workflow emails the reviewer about new records and emails buyers a confirmation or the latest changed status. Edits between runs are reflected as the latest status. The workflow tracks successful sends in `ownerAlertedAt` and `lastEmailedStatus`. If a send fails, it remains eligible on the next run. If SMTP accepts a message and the tracking write fails, the workflow may send it again. Rows without a reference are skipped.

## Verify after deployment

Submit a buyer request with two items, notes, and checked consent. Check that the page shows a reference matching a single row in **Requests**, with a true consent value, and that both inboxes receive the expected message. Edit the status and confirm the buyer gets the update. Submit a farmer registration with two crops and distinct harvest dates, then check **Farmers** and the reviewer inbox. Try an invalid phone, zero quantity, a past delivery date, and unchecked consent.

Retrying unchanged form data in the same tab reuses the reference and checks the sheet before appending. Google Sheets has no unique constraint, so simultaneous submissions using the same reference can still race. If that becomes a problem, serialize intake or move storage to a database with a unique reference.
