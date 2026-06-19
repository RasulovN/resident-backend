/**
 * SMTP test helper.
 *
 *   npm run mail:test                 # just verify the SMTP login
 *   npm run mail:test you@gmail.com   # verify + send a real test email
 *
 * Loads .env fresh on every run, so use it after each change to SMTP_* to know
 * immediately whether the credentials work (the dev server does NOT reload .env).
 */
import { env } from '../config/env';
import { sendMail, verifySmtp } from '../common/utils/mailer';

async function main() {
  const to = process.argv[2];

  console.log('— SMTP configuration —');
  console.log('  HOST  :', env.SMTP_HOST ?? '(unset)');
  console.log('  PORT  :', env.SMTP_PORT, env.SMTP_SECURE ? '(secure/TLS)' : '(STARTTLS)');
  console.log('  USER  :', env.SMTP_USER ?? '(unset)');
  console.log('  FROM  :', env.SMTP_FROM);
  console.log('  PASS  :', env.SMTP_PASS ? `${env.SMTP_PASS.replace(/\s/g, '').length} chars` : '(unset)');
  console.log('');

  if (!env.SMTP_HOST) {
    console.log('❌ SMTP_HOST is not set — emails fall back to the console.');
    process.exit(1);
  }

  console.log('Verifying login…');
  const ok = await verifySmtp();
  if (!ok) {
    console.log('❌ SMTP login FAILED — Google/your provider rejected the credentials.');
    console.log('   For Gmail: enable 2-Step Verification and use a fresh 16-char App Password');
    console.log('   (https://myaccount.google.com/apppasswords). Restart the server after editing .env.');
    process.exit(1);
  }
  console.log('✅ SMTP login OK — credentials are valid.');

  if (to) {
    console.log(`\nSending a test email to ${to}…`);
    await sendMail(
      to,
      'Mahalla OS — test xabari',
      'Tabriklaymiz! SMTP sozlamalari to‘g‘ri ishlayapti. Parolni tiklash va email tasdiqlash '
        + 'xabarlari endi haqiqiy pochtaga yetib boradi.',
      { url: `${env.WEB_URL}/uz/login`, label: 'Tizimga kirish' },
    );
    console.log('✅ Test email sent. Check the inbox (and spam folder).');
  } else {
    console.log('\nTip: pass an address to also send a real test email — npm run mail:test you@gmail.com');
  }

  process.exit(0);
}

main().catch((err) => {
  console.error('❌ Unexpected error:', err);
  process.exit(1);
});
