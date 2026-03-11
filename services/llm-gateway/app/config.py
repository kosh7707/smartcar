from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    llm_mode: str = "mock"
    llm_endpoint: str = "http://localhost:8080"
    llm_model: str = "qwen-14b"
    llm_api_key: str = ""

    model_config = {"env_prefix": "SMARTCAR_"}


settings = Settings()
