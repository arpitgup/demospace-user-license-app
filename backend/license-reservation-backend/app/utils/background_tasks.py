import asyncio
import json
import base64

from datetime import datetime, timezone
from google.cloud import tasks_v2
from google.protobuf import timestamp_pb2
from shared_lib.email_service import get_email_service
from shared_lib.db.models import Reservation, ApplicationDowntime
from shared_lib.db.session import SessionLocal
from loguru import logger
from email.message import EmailMessage
from googleapiclient.errors import HttpError

from ..common.constants import (
    GCP_PROJECT_ID,
    GCP_LOCATION,
    LICENSE_ALLOCATION_QUEUE,
    LICENSE_REVOCATION_QUEUE,
    DOWNTIME_START_QUEUE,
    DOWNTIME_END_QUEUE,
    LICENSE_MANAGEMENT_API_ENDPOINT,
    LICENSE_ENDPOINTS_INVOKER_SERVICE_ACCOUNT,
)


async def schedule_provisioning_task(reservation_id: int, run_at: datetime):
    """Helper function to create a provisioning task for a reservation."""
    timestamp = timestamp_pb2.Timestamp()
    timestamp.FromDatetime(run_at.astimezone(timezone.utc))
    payload = json.dumps({"reservationId": reservation_id})
    task = tasks_v2.Task(
        http_request=tasks_v2.HttpRequest(
            http_method=tasks_v2.HttpMethod.POST,
            url=f"{LICENSE_MANAGEMENT_API_ENDPOINT}/licenses/provision",
            headers={"Content-Type": "application/json"},
            body=payload.encode(),
            oidc_token=tasks_v2.OidcToken(
                service_account_email=LICENSE_ENDPOINTS_INVOKER_SERVICE_ACCOUNT
            ),
        ),
        schedule_time=timestamp,
    )
    client = tasks_v2.CloudTasksAsyncClient()
    response = await client.create_task(
        request=tasks_v2.CreateTaskRequest(
            parent=client.queue_path(
                GCP_PROJECT_ID, GCP_LOCATION, LICENSE_ALLOCATION_QUEUE
            ),
            task=task,
        )
    )
    logger.info(
        f"License provisioning task scheduled for reservation {reservation_id}: {response.name}"
    )
    return response


async def schedule_deprovisioning_task(reservation_id: int, run_at: datetime = None):
    """Helper function to create a deprovisioning task for a reservation."""
    payload = json.dumps({"reservationId": reservation_id})
    task = tasks_v2.Task(
        http_request=tasks_v2.HttpRequest(
            http_method=tasks_v2.HttpMethod.POST,
            url=f"{LICENSE_MANAGEMENT_API_ENDPOINT}/licenses/deprovision",
            headers={"Content-Type": "application/json"},
            body=payload.encode(),
            oidc_token=tasks_v2.OidcToken(
                service_account_email=LICENSE_ENDPOINTS_INVOKER_SERVICE_ACCOUNT
            ),
        ),
    )
    if run_at is not None:
        timestamp = timestamp_pb2.Timestamp()
        timestamp.FromDatetime(run_at.astimezone(timezone.utc))
        task.schedule_time = timestamp
    client = tasks_v2.CloudTasksAsyncClient()
    response = await client.create_task(
        request=tasks_v2.CreateTaskRequest(
            parent=client.queue_path(
                GCP_PROJECT_ID, GCP_LOCATION, LICENSE_REVOCATION_QUEUE
            ),
            task=task,
        )
    )
    logger.info(
        f"License de-provisioning task scheduled for reservation {reservation_id}: {response.name}"
    )
    return response


async def schedule_reservation_tasks(
    reservation_id: int, start_time: datetime, end_time: datetime
):
    """Schedules license provisioning and deprovisioning tasks for a reservation."""
    client = tasks_v2.CloudTasksAsyncClient()

    try:
        provisioning_task_response, deprovisioning_task_response = await asyncio.gather(
            schedule_provisioning_task(
                reservation_id=reservation_id, run_at=start_time
            ),
            schedule_deprovisioning_task(
                reservation_id=reservation_id, run_at=end_time
            ),
        )

        with SessionLocal() as db:
            reservation = (
                db.query(Reservation).filter(Reservation.id == reservation_id).first()
            )
            if reservation:
                reservation.provisioning_task_id = provisioning_task_response.name
                reservation.deprovisioning_task_id = deprovisioning_task_response.name
                db.commit()
                logger.info(f"Updated reservation {reservation_id} with task IDs.")

    except Exception as e:
        logger.error(
            f"Error occurred while scheduling tasks for reservation {reservation_id}: {e}"
        )
        raise e


async def delete_license_provisioning_task(reservation_id: int, task_id: str):
    """Helper function to delete the license provisioning task for a reservation."""
    client = tasks_v2.CloudTasksAsyncClient()
    try:
        await client.delete_task(name=task_id)
        logger.info(
            f"Deleted license provisioning task for reservation {reservation_id}."
        )
    except Exception as e:
        logger.error(
            f"Failed to delete license provisioning task for reservation {reservation_id}: {e}"
        )


async def delete_license_deprovisioning_task(reservation_id: int, task_id: str):
    """Helper function to delete the license de-provisioning task for a reservation."""
    client = tasks_v2.CloudTasksAsyncClient()
    try:
        await client.delete_task(name=task_id)
        logger.info(
            f"Deleted license deprovisioning task for reservation {reservation_id}."
        )
    except Exception as e:
        logger.error(
            f"Failed to delete license deprovisioning task for reservation {reservation_id}: {e}"
        )


async def delete_reservation_tasks(reservation_id: int):
    """Deletes license allocation and revocation tasks for a reservation."""
    with SessionLocal() as db:
        reservation = (
            db.query(Reservation).filter(Reservation.id == reservation_id).first()
        )
        await delete_license_provisioning_task(
            reservation_id, reservation.provisioning_task_id
        )
        await delete_license_deprovisioning_task(
            reservation_id, reservation.deprovisioning_task_id
        )

# Application downtime tasks

async def schedule_start_downtime_task(downtime_id: int, run_at: datetime):
    """Schedules a Cloud Task to start an application downtime period."""
    timestamp = timestamp_pb2.Timestamp()
    timestamp.FromDatetime(run_at.astimezone(timezone.utc))
    payload = json.dumps({"downtimeId": downtime_id})
    task = tasks_v2.Task(
        http_request=tasks_v2.HttpRequest(
            http_method=tasks_v2.HttpMethod.POST,
            url=f"{LICENSE_MANAGEMENT_API_ENDPOINT}/admin/downtime/start",
            headers={"Content-Type": "application/json"},
            body=payload.encode(),
            oidc_token=tasks_v2.OidcToken(
                service_account_email=LICENSE_ENDPOINTS_INVOKER_SERVICE_ACCOUNT
            ),
        ),
        schedule_time=timestamp,
    )
    client = tasks_v2.CloudTasksAsyncClient()
    response = await client.create_task(
        request=tasks_v2.CreateTaskRequest(
            parent=client.queue_path(
                GCP_PROJECT_ID, GCP_LOCATION, DOWNTIME_START_QUEUE
            ),
            task=task,
        )
    )
    logger.info(
        f"Application downtime START task scheduled for downtime {downtime_id}: {response.name}"
    )
    return response


async def schedule_end_downtime_task(downtime_id: int, run_at: datetime):
    """Schedules a Cloud Task to end an application downtime period."""
    timestamp = timestamp_pb2.Timestamp()
    timestamp.FromDatetime(run_at.astimezone(timezone.utc))
    payload = json.dumps({"downtimeId": downtime_id})
    task = tasks_v2.Task(
        http_request=tasks_v2.HttpRequest(
            http_method=tasks_v2.HttpMethod.POST,
            url=f"{LICENSE_MANAGEMENT_API_ENDPOINT}/admin/downtime/end",
            headers={"Content-Type": "application/json"},
            body=payload.encode(),
            oidc_token=tasks_v2.OidcToken(
                service_account_email=LICENSE_ENDPOINTS_INVOKER_SERVICE_ACCOUNT
            ),
        ),
        schedule_time=timestamp,
    )
    client = tasks_v2.CloudTasksAsyncClient()
    response = await client.create_task(
        request=tasks_v2.CreateTaskRequest(
            parent=client.queue_path(
                GCP_PROJECT_ID, GCP_LOCATION, DOWNTIME_END_QUEUE
            ),
            task=task,
        )
    )
    logger.info(
        f"Application downtime END task scheduled for downtime {downtime_id}: {response.name}"
    )
    return response


async def schedule_downtime_tasks(
    downtime_id: int, downtime_start: datetime, downtime_end: datetime
):
    """Schedules Cloud Tasks for both starting and ending an application downtime."""
    try:
        start_task_response, end_task_response = await asyncio.gather(
            schedule_start_downtime_task(
                downtime_id=downtime_id, run_at=downtime_start
            ),
            schedule_end_downtime_task(
                downtime_id=downtime_id, run_at=downtime_end
            ),
        )

        with SessionLocal() as db:
            downtime_entry = (
                db.query(ApplicationDowntime).filter(ApplicationDowntime.id == downtime_id).first()
            )
            if downtime_entry:
                downtime_entry.start_task_id = start_task_response.name                
                downtime_entry.end_task_id = end_task_response.name                
                db.commit()
                logger.info(f"Updated downtime entry {downtime_id} with task IDs.")

    except Exception as e:
        logger.error(
            f"Error occurred while scheduling tasks for downtime {downtime_id}: {e}"
        )
        raise e


async def delete_start_downtime_task(downtime_id: int, task_id: str):
    """Deletes the 'start downtime' Cloud Task for an application downtime."""
    client = tasks_v2.CloudTasksAsyncClient()
    try:
        await client.delete_task(name=task_id)
        logger.info(
            f"Deleted start downtime task for downtime {downtime_id}."
        )
    except Exception as e:
        logger.error(
            f"Failed to delete start downtime task for downtime {downtime_id}: {e}"
        )


async def delete_end_downtime_task(downtime_id: int, task_id: str):
    """Deletes the 'end downtime' Cloud Task for an application downtime."""
    client = tasks_v2.CloudTasksAsyncClient()
    try:
        await client.delete_task(name=task_id)
        logger.info(
            f"Deleted end downtime task for downtime {downtime_id}."
        )
    except Exception as e:
        logger.error(
            f"Failed to delete end downtime task for downtime {downtime_id}: {e}"
        )


async def delete_downtime_tasks(downtime_id: int):
    """Deletes both 'start' and 'end' Cloud Tasks for an application downtime."""
    with SessionLocal() as db:
        downtime_entry = (
            db.query(ApplicationDowntime).filter(ApplicationDowntime.id == downtime_id).first()
        )
        if downtime_entry:
            if downtime_entry.start_task_id:
                await delete_start_downtime_task(
                    downtime_id, downtime_entry.start_task_id
                )
            if downtime_entry.end_task_id:
                await delete_end_downtime_task(
                    downtime_id, downtime_entry.end_task_id
                )

async def sendMakeReservationEmail(recipient_email, sender_email, reservation_id):    
    email_service = get_email_service()
    email_content = """
                    <!DOCTYPE html> 
                    <html lang="en"> 
                    <style> 
                    body { background-color: #f0f0f0; padding: 20px; font-family: Google Sans, Roboto, Arial, Helvetica, sans-serif; } 
                    .digest-block { background-color: #ffffff; border: 1px solid #dcdcdc; border-radius: 12px; padding: 12px 25px; display: inline-flex; align-items: center; box-shadow: 0 1px 2px rgba(0,0,0,0.05); } 
                    .digest-icon { height: 30px; width: auto; margin-right: 12px; vertical-align: middle; } 
                    .digest-text { font-size: 18px; font-weight: bold; color: #000000; white-space: nowrap; } 
                    </style> 
                    <head> 
                        <meta charset="UTF-8"> 
                        <meta name="viewport" content="width=device-width, initial-scale=1.0"> 
                        <title>SaaS Reservation Confirmation</title> 
                    </head> 
                    <body style="margin: 0; padding: 0; background-color: #f4f4f4;"> 
                        <table border="0" cellpadding="0" cellspacing="0" width="100%"> 
                        <tr> 
                            <td style="padding: 20px 0;">  
                            <table align="center" border="0" cellpadding="0" cellspacing="0" width="600" style="border-collapse: collapse; background-color: #ffffff; border-radius: 12px;"> 
                                <tr> 
                                <td align="center" style="padding: 15px 25px;">  
                                    <div class="digest-block" style="background-color: transparent; border: none; box-shadow: none; padding: 0; display: inline-flex; align-items: center;"> 
                                        <img src="REPLACE-IMAGE-SOURCE-HERE" alt="goldemos icon" class="digest-icon" style="vertical-align: middle;"> 
                                        <span class="digest-text" style="font-size: 24px; vertical-align: middle; margin-left: 12px;">REPLACE-DIGEST-TEXT-HERE</span> 
                                    </div> 
                                </td> 
                                </tr> 
                            </table> 
                            </td> 
                        </tr> 
                        </table> 
                        <table border="0" cellpadding="0" cellspacing="0" width="100%"> 
                            <tr> 
                                <td style="padding: 20px 0;"> 
                                    <table align="center" border="0" cellpadding="0" cellspacing="0" width="600" style="border-collapse: collapse; background-color: #ffffff; border-radius: 12px;"> 
                                        <tr> 
                                            <td align="left" bgcolor="#ffffff" style="padding: 10px 30px 20px 30px; border-bottom: 1px solid #eeeeee; border-top-left-radius: 12px; border-top-right-radius: 12px;">  
                                            <div style="color: #5f6368; font-family: 'Google Sans', Roboto, Arial, sans-serif; font-size: 14px; line-height: 1.5;"> 
                                                    REPLACE-HEADER-SUBTEXT-HERE 
                                                </div> 
                                                <div style="color: #202124; font-family: 'Google Sans', Roboto, Arial, sans-serif; font-size: 22px; line-height: 1.3; padding-top: 4px;"> 
                                                    REPLACE-HEADER-TITLE-HERE
                                                </div> 
                                            </td> 
                                        </tr> 
                                        <tr> 
                                            <td bgcolor="#ffffff" style="padding: 20px 30px 40px 30px; border-bottom-left-radius: 12px; border-bottom-right-radius: 12px;"> 
                                                <p style="margin: 0 0 15px 0; color: #3c4043; font-family: Roboto, Arial, sans-serif; font-size: 14px; line-height: 1.5;"> 
                                                    Hello, REPLACE-RECIPIENT-NAME-HERE 
                                                </p> 
                                                <p style="margin: 0 0 15px 0; color: #3c4043; font-family: Roboto, Arial, sans-serif; font-size: 14px; line-height: 1.5;"> 
                                                    REPLACE-CONFIRMATION-MESSAGE-HERE 
                                                </p> 
                                                <div style="font-family: Roboto, Arial, sans-serif; font-size: 14px; line-height: 1.6; color: #3c4043;"> 
                                                    REPLACE-RESERVATION-DETAILS-HTML-HERE
                                                </div> 
                                                <p style="margin: 20px 0 15px 0; color: #3c4043; font-family: Roboto, Arial, sans-serif; font-size: 14px; line-height: 1.5;"> 
                                                    You can view and manage your reservations here: <a href="REPLACE-LINK-URL-HERE" style="color:#4285F4;text-decoration:underline;">REPLACE-LINK-TEXT-HERE</a> 
                                                </p> 
                                                <p style="margin: 0; color: #5f6368; font-family: Roboto, Arial, sans-serif; font-size: 12px; line-height: 1.5;"> 
                                                    This is an automated message. Please do not reply directly to this email. 
                                                </p> 
                                            </td> 
                                        </tr> 
                                    </table> 
                                </td> 
                            </tr> 
                        </table> 
                        </body> 
                    </html>
                    """
    try:
        message = EmailMessage()
        message.add_alternative(email_content, subtype="html")

        message["To"] = recipient_email
        message["From"] = sender_email
        message["Subject"] = "MakeReservationSubjectHere"

        encoded_message = base64.urlsafe_b64encode(message.as_bytes()).decode()

        create_message = {"raw": encoded_message}
        send_message = (
            email_service.users()
            .messages()
            .send(userId="me", body=create_message)
            .execute()
        )
        print(f'Message Id: {send_message["id"]}')
    except HttpError as error:
        print(f"An error occurred: {error}")
        send_message = None
    logger.info(
        f"Email Notification sent to {recipient_email} for successful reservation {reservation_id}"
    )
    return send_message

async def sendCancelReservationEmail(recipient_email, sender_email, reservation_id):    
    email_service = get_email_service()
    email_content = """
                    <!DOCTYPE html> 
                    <html lang="en"> 
                    <style> 
                    body { background-color: #f0f0f0; padding: 20px; font-family: Google Sans, Roboto, Arial, Helvetica, sans-serif; } 
                    .digest-block { background-color: #ffffff; border: 1px solid #dcdcdc; border-radius: 12px; padding: 12px 25px; display: inline-flex; align-items: center; box-shadow: 0 1px 2px rgba(0,0,0,0.05); } 
                    .digest-icon { height: 30px; width: auto; margin-right: 12px; vertical-align: middle; } 
                    .digest-text { font-size: 18px; font-weight: bold; color: #000000; white-space: nowrap; } 
                    </style> 
                    <head> 
                        <meta charset="UTF-8"> 
                        <meta name="viewport" content="width=device-width, initial-scale=1.0"> 
                        <title>SaaS Reservation Confirmation</title> 
                    </head> 
                    <body style="margin: 0; padding: 0; background-color: #f4f4f4;"> 
                        <table border="0" cellpadding="0" cellspacing="0" width="100%"> 
                        <tr> 
                            <td style="padding: 20px 0;">  
                            <table align="center" border="0" cellpadding="0" cellspacing="0" width="600" style="border-collapse: collapse; background-color: #ffffff; border-radius: 12px;"> 
                                <tr> 
                                <td align="center" style="padding: 15px 25px;">  
                                    <div class="digest-block" style="background-color: transparent; border: none; box-shadow: none; padding: 0; display: inline-flex; align-items: center;"> 
                                        <img src="REPLACE-IMAGE-SOURCE-HERE" alt="goldemos icon" class="digest-icon" style="vertical-align: middle;"> 
                                        <span class="digest-text" style="font-size: 24px; vertical-align: middle; margin-left: 12px;">REPLACE-DIGEST-TEXT-HERE</span> 
                                    </div> 
                                </td> 
                                </tr> 
                            </table> 
                            </td> 
                        </tr> 
                        </table> 
                        <table border="0" cellpadding="0" cellspacing="0" width="100%"> 
                            <tr> 
                                <td style="padding: 20px 0;"> 
                                    <table align="center" border="0" cellpadding="0" cellspacing="0" width="600" style="border-collapse: collapse; background-color: #ffffff; border-radius: 12px;"> 
                                        <tr> 
                                            <td align="left" bgcolor="#ffffff" style="padding: 10px 30px 20px 30px; border-bottom: 1px solid #eeeeee; border-top-left-radius: 12px; border-top-right-radius: 12px;">  
                                            <div style="color: #5f6368; font-family: 'Google Sans', Roboto, Arial, sans-serif; font-size: 14px; line-height: 1.5;"> 
                                                    REPLACE-HEADER-SUBTEXT-HERE 
                                                </div> 
                                                <div style="color: #202124; font-family: 'Google Sans', Roboto, Arial, sans-serif; font-size: 22px; line-height: 1.3; padding-top: 4px;"> 
                                                    REPLACE-HEADER-TITLE-HERE
                                                </div> 
                                            </td> 
                                        </tr> 
                                        <tr> 
                                            <td bgcolor="#ffffff" style="padding: 20px 30px 40px 30px; border-bottom-left-radius: 12px; border-bottom-right-radius: 12px;"> 
                                                <p style="margin: 0 0 15px 0; color: #3c4043; font-family: Roboto, Arial, sans-serif; font-size: 14px; line-height: 1.5;"> 
                                                    Hello, REPLACE-RECIPIENT-NAME-HERE 
                                                </p> 
                                                <p style="margin: 0 0 15px 0; color: #3c4043; font-family: Roboto, Arial, sans-serif; font-size: 14px; line-height: 1.5;"> 
                                                    REPLACE-CONFIRMATION-MESSAGE-HERE 
                                                </p> 
                                                <div style="font-family: Roboto, Arial, sans-serif; font-size: 14px; line-height: 1.6; color: #3c4043;"> 
                                                    REPLACE-RESERVATION-DETAILS-HTML-HERE
                                                </div> 
                                                <p style="margin: 20px 0 15px 0; color: #3c4043; font-family: Roboto, Arial, sans-serif; font-size: 14px; line-height: 1.5;"> 
                                                    You can view and manage your reservations here: <a href="REPLACE-LINK-URL-HERE" style="color:#4285F4;text-decoration:underline;">REPLACE-LINK-TEXT-HERE</a> 
                                                </p> 
                                                <p style="margin: 0; color: #5f6368; font-family: Roboto, Arial, sans-serif; font-size: 12px; line-height: 1.5;"> 
                                                    This is an automated message. Please do not reply directly to this email. 
                                                </p> 
                                            </td> 
                                        </tr> 
                                    </table> 
                                </td> 
                            </tr> 
                        </table> 
                        </body> 
                    </html>
                    """
    try:
        message = EmailMessage()
        message.add_alternative(email_content, subtype="html")

        message["To"] = recipient_email
        message["From"] = sender_email
        message["Subject"] = "CancelEmailSubjectHere"

        encoded_message = base64.urlsafe_b64encode(message.as_bytes()).decode()

        create_message = {"raw": encoded_message}
        send_message = (
            email_service.users()
            .messages()
            .send(userId="me", body=create_message)
            .execute()
        )
        print(f'Message Id: {send_message["id"]}')
    except HttpError as error:
        print(f"An error occurred: {error}")
        send_message = None
    logger.info(
        f"Email Notification sent to {recipient_email} for cancel reservation {reservation_id}"
    )
    return send_message