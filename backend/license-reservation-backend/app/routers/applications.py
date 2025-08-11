from fastapi import APIRouter, Depends
from shared_lib.dependencies import get_db
from shared_lib.db.models import Application
from sqlalchemy.orm import Session
from typing import List

from ..common.schemas import ApplicationOut


router = APIRouter()


@router.get("/applications", response_model=List[ApplicationOut])
def get_all_applications(db: Session = Depends(get_db)):
    """
    Returns a list of all applications available in the system.
    """
    return db.query(Application).all()
