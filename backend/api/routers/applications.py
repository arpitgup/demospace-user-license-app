from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from typing import List

from ..common.models import Application
from ..common.schemas import ApplicationOut
from ..utils.dependencies import get_db


router = APIRouter()


@router.get("/applications", response_model=List[ApplicationOut])
def get_all_applications(db: Session = Depends(get_db)):
    """
    Returns a list of all applications available in the system.
    """
    return db.query(Application).all()
