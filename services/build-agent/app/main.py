import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI
from app.agent_runtime.observability import setup_logging
from app.routers import tasks

_SERVICE_NAME = "aegis-build-agent"
_log_dir = setup_logging(_SERVICE_NAME, service_id="s3-build")

_exchange_handler = logging.FileHandler(_log_dir / "llm-exchange.jsonl")
_exchange_handler.setFormatter(logging.Formatter("%(message)s"))
logging.getLogger("llm_exchange").addHandler(_exchange_handler)
logging.getLogger("llm_exchange").setLevel(logging.INFO)
logging.getLogger("llm_exchange").propagate = False

logger = logging.getLogger(__name__)

@asynccontextmanager
async def lifespan(app: FastAPI):
    from app.config import settings
    logger.info("Build Agent started (mode: %s)", settings.llm_mode)
    yield
    logger.info("Build Agent stopped")

app = FastAPI(title="AEGIS Build Agent", version="1.0.0", lifespan=lifespan)
app.include_router(tasks.router)
