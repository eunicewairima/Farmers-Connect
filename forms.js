const businessDate = new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Nairobi' });
const phonePattern = /^(?:0[17][0-9]{8}|\+254[17][0-9]{8}|\+(?!254)[1-9][0-9]{7,14})$/;
const emailPattern = /^[a-z0-9.!#$%&'*+/=?^_\x60{|}~-]+@[a-z0-9-]+(?:\.[a-z0-9-]+)+$/i;
const itemTemplate = document.querySelector('#produce-item');
const maxItems = 20;

for (const form of document.querySelectorAll('form[data-kind]')) {
    const farmer = form.dataset.kind === 'farmer';
    const items = form.querySelector('[data-items]');
    const addButton = form.querySelector('[data-add]');
    const submitButton = form.querySelector('[type="submit"]');
    const feedback = form.querySelector('[data-feedback]');
    const submitLabel = submitButton.textContent;
    let pending;
    let submitting = false;

    function updateItems() {
        addButton.disabled = items.children.length >= maxItems;
        for (const button of items.querySelectorAll('[data-remove]')) {
            button.hidden = items.children.length === 1;
        }
        for (const field of form.querySelectorAll('[data-future-date]')) {
            field.min = businessDate.format(new Date());
        }
    }

    function addItem(focus = false) {
        const row = itemTemplate.content.firstElementChild.cloneNode(true);
        if (farmer) {
            row.querySelector('[name="harvestDate"]').required = true;
        } else {
            row.querySelector('[data-harvest]').remove();
        }
        row.querySelector('[data-remove]').addEventListener('click', () => {
            row.remove();
            updateItems();
            addButton.focus();
        });
        items.append(row);
        updateItems();
        if (focus) row.querySelector('input').focus();
    }

    function showFeedback(message, error) {
        feedback.textContent = message;
        feedback.classList.toggle('text-red-800', error);
        feedback.classList.toggle('text-forest-800', !error);
        feedback.focus();
    }

    addItem();
    submitButton.disabled = false;
    addButton.addEventListener('click', () => addItem(true));
    form.addEventListener('focusin', updateItems);
    form.addEventListener('input', (event) => event.target.setCustomValidity?.(''));

    form.addEventListener('submit', async (event) => {
        event.preventDefault();
        if (submitting) return;
        updateItems();

        for (const field of form.querySelectorAll('input[required]:not([type="checkbox"])')) {
            if (!field.value.trim()) field.setCustomValidity('Please fill in this field.');
        }
        const phone = form.elements.phone.value.trim().replace(/[ ()-]/g, '');
        if (!phonePattern.test(phone)) {
            form.elements.phone.setCustomValidity('Enter a Kenyan mobile number or an international number starting with +.');
        }
        if (!farmer && !emailPattern.test(form.elements.email.value.trim())) {
            form.elements.email.setCustomValidity('Enter an email address such as name@example.com.');
        }
        if (!form.reportValidity()) return;

        const data = new FormData(form);
        const nameField = farmer ? 'farmerName' : 'buyerName';
        const payload = {
            [nameField]: data.get(nameField).trim(),
            phone: phone.replace(/^0/, '+254'),
            location: data.get('location').trim(),
            dataConsent: data.get('dataConsent'),
            items: JSON.stringify(Array.from(items.children, (row) => ({
                produce: row.querySelector('[name="produce"]').value.trim(),
                quantityKg: Number(row.querySelector('[name="quantityKg"]').value),
                ...(farmer && { harvestDate: row.querySelector('[name="harvestDate"]').value }),
            }))),
        };
        if (!farmer) {
            payload.email = data.get('email').trim();
            payload.notes = data.get('notes').trim();
            payload.preferredDeliveryDate = data.get('preferredDeliveryDate');
        }

        const body = new URLSearchParams(payload);
        const signature = body.toString();
        // Keep the reference when retrying an unchanged submission after a network error.
        if (pending?.signature !== signature) pending = { signature, reference: crypto.randomUUID() };
        body.set('reference', pending.reference);

        submitting = true;
        submitButton.disabled = true;
        submitButton.textContent = 'Submitting…';
        feedback.textContent = '';
        try {
            const response = await fetch(form.action, {
                method: 'POST',
                body,
                signal: AbortSignal.timeout(20000),
            });
            const receipt = await response.json();
            if (!response.ok || receipt.saved !== true || receipt.reference !== pending.reference) {
                throw new Error('No matching receipt');
            }
            const label = farmer ? 'Registration received.' : 'Produce request received.';
            form.reset();
            items.replaceChildren();
            addItem();
            pending = undefined;
            showFeedback(`${label} Your reference is ${receipt.reference}.`, false);
        } catch {
            showFeedback(`We couldn’t confirm your submission. Please retry using the same details. Reference ${pending.reference}.`, true);
        } finally {
            submitting = false;
            submitButton.disabled = false;
            submitButton.textContent = submitLabel;
        }
    });
}
