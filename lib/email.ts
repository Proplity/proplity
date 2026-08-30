// Console-transport email -- logs the content instead of delivering it.
// Swapping in a real provider (Resend, Postmark, SES) later means replacing
// only this function; every caller already has the right shape.
export async function sendEmail({
  to,
  subject,
  body,
}: {
  to: string;
  subject: string;
  body: string;
}) {
  console.log('\n===== EMAIL (console transport) =====');
  console.log(`To: ${to}`);
  console.log(`Subject: ${subject}`);
  console.log('---');
  console.log(body);
  console.log('=======================================\n');
}
