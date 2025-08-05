import logging


def setup_logger():
    """Configures and returns a common logger instance."""
    logger = logging.getLogger("agentspace_license_reservation_api")
    logger.setLevel(logging.INFO)

    # Create console handler and set level to info
    console_handler = logging.StreamHandler()
    console_handler.setLevel(logging.INFO)
    formatter = logging.Formatter(
        "%(asctime)s - %(name)s - %(levelname)s - %(message)s"
    )
    console_handler.setFormatter(formatter)

    # Prevent adding multiple handlers if setup_logger is called multiple times
    if not logger.handlers:
        logger.addHandler(console_handler)

    return logger


logger = setup_logger()
