from datetime import datetime, timezone
from uuid import uuid4

from fastapi import APIRouter, Depends
from pydantic import BaseModel, EmailStr, Field
from sqlalchemy.orm import Session

from app.db.models import ContactSubmission
from app.db.session import get_db

router = APIRouter()


class ContactFormIn(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    email: EmailStr
    subject: str = Field(..., min_length=1, max_length=255)
    message: str = Field(..., min_length=1, max_length=5000)


class ContactFormOut(BaseModel):
    ok: bool = True
    message: str = "Thank you for reaching out. We will get back to you shortly."


@router.post("/contact", response_model=ContactFormOut)
def submit_contact_form(body: ContactFormIn, db: Session = Depends(get_db)):
    submission = ContactSubmission(
        id=str(uuid4()),
        name=body.name,
        email=body.email,
        subject=body.subject,
        message=body.message,
        created_at=datetime.now(timezone.utc),
    )
    db.add(submission)
    db.commit()

    from app.services.email_service import EmailService
    from app.services.email_settings_service import get_or_create
    from app.core.settings import get_settings

    settings = get_settings()
    email_svc = EmailService(settings, db)
    email_row = get_or_create(db)
    to_email = email_row.from_email or body.email

    email_svc.send_transactional(
        to_addresses=[to_email],
        subject=f"Contact form: {body.subject}",
        text_body=f"Name: {body.name}\nEmail: {body.email}\nSubject: {body.subject}\n\n{body.message}",
    )

    return ContactFormOut()
