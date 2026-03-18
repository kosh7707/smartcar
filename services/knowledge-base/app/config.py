from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    qdrant_path: str = "data/qdrant"
    rag_top_k: int = 5
    rag_min_score: float = 0.35
    graph_depth: int = 2

    neo4j_uri: str = "bolt://localhost:7687"
    neo4j_user: str = "neo4j"
    neo4j_password: str = "smartcar"

    model_config = {"env_prefix": "SMARTCAR_KB_", "env_file": ".env"}


settings = Settings()
