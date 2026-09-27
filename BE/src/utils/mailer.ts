import nodemailer from 'nodemailer';

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'smtp.gmail.com',
  port: parseInt(process.env.SMTP_PORT || '587', 10),
  secure: process.env.SMTP_SECURE === 'true',
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

export const sendOtpEmail = async (to: string, otp: string) => {
  if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
    console.warn('[MAILER] SMTP_USER or SMTP_PASS is missing, simulating email sending...');
    console.log(`[MAILER] SIMULATED EMAIL TO: ${to} | OTP: ${otp}`);
    return;
  }

  const mailOptions = {
    from: `"Sports Center" <${process.env.SMTP_USER}>`,
    to,
    subject: 'Mã xác nhận đổi mật khẩu',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto; padding: 20px; border: 1px solid #ccc; border-radius: 10px;">
        <h2 style="color: #333; text-align: center;">Mã xác nhận đổi mật khẩu</h2>
        <p>Xin chào,</p>
        <p>Bạn đã yêu cầu đặt lại mật khẩu cho tài khoản tại hệ thống Sports Center. Vui lòng sử dụng mã OTP dưới đây để tiến hành đặt lại mật khẩu:</p>
        <h1 style="color: #007bff; text-align: center; letter-spacing: 5px;">${otp}</h1>
        <p>Mã này sẽ hết hạn sau 5 phút.</p>
        <p>Nếu bạn không yêu cầu đổi mật khẩu, vui lòng bỏ qua email này.</p>
        <hr />
        <p style="font-size: 12px; color: #888; text-align: center;">Trân trọng,<br>Đội ngũ Sports Center</p>
      </div>
    `,
  };

  try {
    await transporter.sendMail(mailOptions);
  } catch (error) {
    console.error('[MAILER] Error sending email:', error);
    throw new Error('Failed to send OTP email');
  }
};
