import os
import smtplib
import logging
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart

logger = logging.getLogger(__name__)

async def send_verification_email(email: str, code: str):
    """Sends email verification code via SMTP or prints to console as fallback."""
    smtp_server = os.getenv("SMTP_SERVER")
    smtp_port = os.getenv("SMTP_PORT")
    smtp_username = os.getenv("SMTP_USERNAME")
    smtp_password = os.getenv("SMTP_PASSWORD")
    smtp_sender = os.getenv("SMTP_SENDER", "noreply@tripmate.com")

    subject = "Verify your TripMate AI Account"
    body = f"""
    Hi there,

    Welcome to TripMate AI! 
    Please use the following 6-digit verification code to complete your signup:

    👉 {code} 👈

    This code is valid for 10 minutes.

    Happy travels,
    The TripMate AI Team
    """

    # Print to console prominently for debugging
    print("\n" + "="*60)
    print(f"EMAIL VERIFICATION SENT TO: {email}")
    print(f"CODE: {code}")
    print("="*60 + "\n", flush=True)

    if smtp_server and smtp_port and smtp_username and smtp_password:
        try:
            msg = MIMEMultipart()
            msg["From"] = smtp_sender
            msg["To"] = email
            msg["Subject"] = subject
            msg.attach(MIMEText(body, "plain"))

            port = int(smtp_port)
            if port == 465:
                server = smtplib.SMTP_SSL(smtp_server, port)
                server.login(smtp_username, smtp_password)
            else:
                server = smtplib.SMTP(smtp_server, port)
                server.starttls()
                server.login(smtp_username, smtp_password)
            
            server.sendmail(smtp_sender, email, msg.as_string())
            server.close()
            logger.info(f"Verification email successfully sent to {email}")
        except Exception as e:
            logger.error(f"Failed to send email via SMTP: {e}")
