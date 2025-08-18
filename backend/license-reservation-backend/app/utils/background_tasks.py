import asyncio
import json

from datetime import datetime, timezone
from google.cloud import tasks_v2
from google.protobuf import timestamp_pb2
from shared_lib.db.models import Reservation
from shared_lib.db.session import SessionLocal
from loguru import logger

from ..common.constants import (
    GCP_PROJECT_ID,
    GCP_LOCATION,
    LICENSE_ALLOCATION_QUEUE,
    LICENSE_REVOCATION_QUEUE,
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
