from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    qdrant_path: str = "data/qdrant"
    rag_top_k: int = 5
    rag_min_score: float = 0.35
    graph_depth: int = 2

    neo4j_uri: str = "bolt://localhost:7687"
    neo4j_user: str = "neo4j"
    neo4j_password: str = "aegis-kb"

    nvd_api_key: str = ""
    nvd_api_base: str = "https://services.nvd.nist.gov/rest/json/cves/2.0"
    nvd_rate_delay: float = 1.0
    nvd_cache_ttl: int = 86400
    nvd_batch_concurrency: int = 5
    epss_enabled: bool = True
    kev_ttl: int = 3600

    rrf_k: int = 60

    model_config = {"env_prefix": "AEGIS_KB_", "env_file": ".env"}


settings = Settings()
