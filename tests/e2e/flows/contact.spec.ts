import { test, expect, type Page } from '@playwright/test';

// The contact form only claims "Message sent!" when the server says the email went out. The
// route itself is covered in tests/api/contact.test.ts; here the answer is mocked so the page's
// two outcomes can be seen without sending anything.

async function fillForm(page: Page) {
  await page.goto('/contact');
  await page.getByPlaceholder('First Name').fill('Ada');
  await page.getByPlaceholder('Last Name').fill('Obi');
  await page.getByPlaceholder('you@company.com').fill('ada@example.com');
  await page.getByPlaceholder('Tell us about your portfolio...').fill('I manage 12 flats in Yaba.');
}

test('the form shows an error, not "Message sent!", when the message could not go out', async ({
  page,
}) => {
  await page.route('**/api/v1/contact', (route) =>
    route.fulfill({
      status: 502,
      contentType: 'application/json',
      body: JSON.stringify({ error: "We couldn't send your message. Please try again later." }),
    }),
  );
  await fillForm(page);
  await page.getByRole('button', { name: 'Send Message' }).click();

  // Next adds its own route announcer with role="alert", so look inside the form.
  await expect(page.locator('form [role="alert"]')).toContainText("We couldn't send your message");
  await expect(page.getByText('Message sent!')).toHaveCount(0);
  // What they typed is still there, so they can try again.
  await expect(page.getByPlaceholder('Tell us about your portfolio...')).toHaveValue(
    'I manage 12 flats in Yaba.',
  );
});

test('the form says "Message sent!" only after the server accepts the message', async ({
  page,
}) => {
  let body: Record<string, unknown> | undefined;
  await page.route('**/api/v1/contact', async (route) => {
    body = route.request().postDataJSON();
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ success: true }),
    });
  });
  await fillForm(page);
  await page.getByRole('button', { name: 'Send Message' }).click();

  await expect(page.getByText('Message sent!')).toBeVisible();
  expect(body).toMatchObject({
    firstName: 'Ada',
    lastName: 'Obi',
    email: 'ada@example.com',
    message: 'I manage 12 flats in Yaba.',
  });
});
