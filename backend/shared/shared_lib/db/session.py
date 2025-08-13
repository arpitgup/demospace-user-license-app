import os

from sqlalchemy import create_engine, URL
from sqlalchemy.orm import sessionmaker

from ..utils import get_secret_value


def setup_database_session():
    db_url = URL.create(
        drivername="postgresql+psycopg2",
        username=os.getenv("DB_USER"),
        password=get_secret_value(
            project_id=os.getenv("GCP_PROJECT_ID"),
            secret_name=os.getenv("DB_PASSWORD_SECRET_NAME"),
        ),
        host=os.getenv("DB_HOST"),
        port=os.getenv("DB_PORT"),
        database=os.getenv("DB_NAME"),
    )
    engine = create_engine(db_url)
    session = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    return session


SessionLocal = setup_database_session()
