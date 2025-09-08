import json
import os

from google.oauth2 import service_account
from googleapiclient.discovery import build

from .utils import get_secret_value


def get_email_service():
    """Sets up and returns the email service for sending emails."""    
    SCOPES = [
        "https://mail.google.com/",
        "https://www.googleapis.com/auth/gmail.modify",
        "https://www.googleapis.com/auth/gmail.readonly"
    ]
    project_id = os.getenv("GCP_PROJECT_ID")
    secret_name = os.getenv("ADMIN_SERVICE_ACCOUNT_KEY_SECRET_NAME")
    delegated_admin = os.getenv("DELEGATED_ADMIN")
    service_account_info = get_secret_value(project_id, secret_name)
    credentials = service_account.Credentials.from_service_account_info(
        json.loads(service_account_info), scopes=SCOPES
    )
    delegated_credentials = credentials.with_subject(delegated_admin)
    return build("gmail", "v1", credentials=delegated_credentials)