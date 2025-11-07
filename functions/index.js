const functions = require('firebase-functions');
const admin = require('firebase-admin');
const nodemailer = require('nodemailer');

// Initialize admin SDK
admin.initializeApp();

// Read SMTP/app config from functions config (set with `firebase functions:config:set`)
// Note: functions.config() is being deprecated; prefer Secret Manager or env vars for production.
const smtpConfig = functions.config().smtp || {};
const mailFrom = (functions.config().mail && functions.config().mail.from) || process.env.MAIL_FROM || smtpConfig.user || 'no-reply@example.com';
const appUrl = (functions.config().app && functions.config().app.url) || process.env.FRONTEND_URL || 'https://your-app-url.example';

let transporter = null;

function createTransportFromConfig(cfg) {
  return nodemailer.createTransport({
    host: cfg.host,
    port: cfg.port ? parseInt(cfg.port, 10) : 587,
    secure: cfg.secure === 'true' || cfg.secure === true || (cfg.port && parseInt(cfg.port, 10) === 465),
    auth: {
      user: cfg.user,
      pass: cfg.pass
    }
  });
}

// Support three config sources (priority): functions.config().smtp -> process.env -> none
const envSmtp = {
  host: process.env.SMTP_HOST,
  port: process.env.SMTP_PORT,
  secure: process.env.SMTP_SECURE,
  user: process.env.SMTP_USER,
  pass: process.env.SMTP_PASS
};

if (smtpConfig.host && smtpConfig.user && smtpConfig.pass) {
  transporter = createTransportFromConfig(smtpConfig);
  console.log('Using SMTP config from functions.config()');
} else if (envSmtp.host && envSmtp.user && envSmtp.pass) {
  transporter = createTransportFromConfig(envSmtp);
  console.log('Using SMTP config from environment variables (process.env).');
} else {
  console.warn('SMTP config not found. Set functions config or environment variables: smtp.host/smtp.user/smtp.pass (and optionally port/secure).');
}

// Verify transporter at cold start so auth errors are visible in logs quickly.
if (transporter) {
  transporter.verify().then(() => {
    console.log('SMTP transporter verified successfully');
  }).catch((err) => {
    console.error('SMTP transporter verification failed:', err && (err.message || err));
  });
}

async function sendMailSafe(mailOptions) {
  if (!transporter) {
    const msg = `No email transporter configured, skipping sending email to ${mailOptions.to}`;
    console.warn(msg);
    return { success: false, error: msg };
  }
  try {
    const res = await transporter.sendMail(mailOptions);
    console.log('Email sent (nodemailer) to', mailOptions.to, res && res.messageId);
    return { success: true, result: res };
  } catch (err) {
    console.error('Failed to send email via nodemailer', err && (err.message || err));
    return { success: false, error: err.message || String(err) };
  }
}

// HTTP test endpoint to verify SMTP config and send a test email.
exports.testSendEmail = functions.https.onRequest(async (req, res) => {
  const to = req.query.to || (req.body && req.body.to);
  const subject = req.query.subject || (req.body && req.body.subject) || 'Test email from leave-management-system';
  const text = req.query.text || (req.body && req.body.text) || 'This is a test email.';
  if (!to) {
    res.status(400).send('Missing `to` parameter (query or body)');
    return;
  }
  const mailOptions = { from: mailFrom, to, subject, text, html: `<p>${text}</p>` };
  const r = await sendMailSafe(mailOptions);
  if (!r || r.success === false) {
    res.status(500).json({ success: false, error: r ? r.error : 'Unknown error sending email' });
    return;
  }
  res.json({ success: true, messageId: r.result && r.result.messageId });
});

/**
 * When a new leave is created, notify the assigned teacher (if any).
 */
exports.notifyTeacherOnLeave = functions.firestore.document('leaves/{leaveId}').onCreate(async (snap, context) => {
  const data = snap.data() || {};
  const leaveId = context.params.leaveId;
  const teacherUid = data.assignedTeacherUid || (data.course && data.course.teacherUid) || null;
  if (!teacherUid) {
    console.log(`Leave ${leaveId} has no assignedTeacherUid — skipping teacher notification.`);
    return null;
  }

  // fetch teacher user doc to get email (and name)
  try {
    const teacherDoc = await admin.firestore().doc(`users/${teacherUid}`).get();
    if (!teacherDoc.exists) {
      console.log(`Teacher user doc not found: ${teacherUid}`);
      return null;
    }
    const teacher = teacherDoc.data() || {};
    const toEmail = teacher.email;
    if (!toEmail) {
      console.log(`Teacher ${teacherUid} has no email field — skipping`);
      return null;
    }

    const subject = `新請假通知：${data.userName || '學生'} 的請假申請`;
    const text = `學生：${data.userName || 'Unknown'}\n類型：${data.type || ''}\n課程：${(data.course && (data.course.name || data.course.code)) || ''}\n開始：${data.startDate ? (data.startDate.toDate ? data.startDate.toDate() : data.startDate) : ''}\n結束：${data.endDate ? (data.endDate.toDate ? data.endDate.toDate() : data.endDate) : ''}\n原因：${data.reason || ''}\n\n檢視申請：${appUrl}/leave-list`;

    const html = `<p>學生：<b>${data.userName || 'Unknown'}</b></p>
      <p>類型：${data.type || ''}<br/>課程：${(data.course && (data.course.name || data.course.code)) || ''}<br/>開始：${data.startDate ? (data.startDate.toDate ? data.startDate.toDate() : data.startDate) : ''}<br/>結束：${data.endDate ? (data.endDate.toDate ? data.endDate.toDate() : data.endDate) : ''}</p>
      <p>原因：${data.reason || ''}</p>
      <p><a href="${appUrl}/leave-list">前往系統查看並審核</a></p>`;

    const mailOptions = {
      from: mailFrom,
      to: toEmail,
      subject,
      text,
      html
    };

    return await sendMailSafe(mailOptions);
  } catch (err) {
    console.error('notifyTeacherOnLeave failed', err);
    return null;
  }
});

/**
 * When a leave is updated, if status changed to approved/rejected, notify the student.
 */
exports.notifyStudentOnReview = functions.firestore.document('leaves/{leaveId}').onUpdate(async (change, context) => {
  const before = change.before.data() || {};
  const after = change.after.data() || {};
  const leaveId = context.params.leaveId;
  const prevStatus = before.status;
  const newStatus = after.status;
  if (prevStatus === newStatus) {
    console.log(`Leave ${leaveId} status unchanged (${newStatus}) — no notification.`);
    return null;
  }
  if (!['approved', 'rejected'].includes(newStatus)) {
    console.log(`Leave ${leaveId} updated to status ${newStatus} — not an approval/rejection.`);
    return null;
  }

  try {
    const userId = after.userId;
    if (!userId) {
      console.log(`Leave ${leaveId} has no userId — skipping student notification.`);
      return null;
    }
    const userDoc = await admin.firestore().doc(`users/${userId}`).get();
    if (!userDoc.exists) {
      console.log(`Student user doc not found: ${userId}`);
      return null;
    }
    const user = userDoc.data() || {};
    const toEmail = user.email;
    if (!toEmail) {
      console.log(`Student ${userId} has no email — skipping notification.`);
      return null;
    }

    const subject = `您的請假申請已${newStatus === 'approved' ? '核准' : '被拒絕'}`;
    const reason = after.reviewComment || '';
    const text = `您的請假申請狀態：${newStatus}\n課程：${(after.course && (after.course.name || after.course.code)) || ''}\n開始：${after.startDate ? (after.startDate.toDate ? after.startDate.toDate() : after.startDate) : ''}\n結束：${after.endDate ? (after.endDate.toDate ? after.endDate.toDate() : after.endDate) : ''}\n教師評論：${reason}\n\n系統連結：${appUrl}/leave-list`;

    const html = `<p>您的請假申請已 <b>${newStatus}</b></p>
      <p>課程：${(after.course && (after.course.name || after.course.code)) || ''}<br/>開始：${after.startDate ? (after.startDate.toDate ? after.startDate.toDate() : after.startDate) : ''}<br/>結束：${after.endDate ? (after.endDate.toDate ? after.endDate.toDate() : after.endDate) : ''}</p>
      <p>教師回覆：${reason}</p>
      <p><a href="${appUrl}/leave-list">前往系統查看</a></p>`;

    const mailOptions = {
      from: mailFrom,
      to: toEmail,
      subject,
      text,
      html
    };

    return await sendMailSafe(mailOptions);
  } catch (err) {
    console.error('notifyStudentOnReview failed', err);
    return null;
  }
});
