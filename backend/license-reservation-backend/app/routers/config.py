from fastapi import APIRouter, BackgroundTasks, Depends
from shared_lib.dependencies import get_db, refresh_app_config
from shared_lib.db.models import AppConfig
from sqlalchemy.orm import Session
from typing import List

from ..common.schemas import ConfigOut, UpdateAppConfigRequest


router = APIRouter()


# TODO: Add test
@router.post("/config", response_model=List[ConfigOut])
def set_app_config(
    req: UpdateAppConfigRequest,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
):
    config_keys = [config["key"] for config in req.configs]
    configs = db.query(AppConfig).filter(AppConfig.key.in_(config_keys)).all()
    config_map = {config.key: config for config in configs}
    for config in req.configs:
        key = config["key"]
        if key in config_map:
            config_map[key].value = config["value"]
            config_map[key].description = config.get("description")
    db.commit()
    db.refresh(configs)
    background_tasks.add_task(refresh_app_config)
    return configs


# TODO: Add test
@router.get("/config")
def get_app_config(db: Session = Depends(get_db)):
    configs = db.query(AppConfig).all()
    return {config.key: config for config in configs}
