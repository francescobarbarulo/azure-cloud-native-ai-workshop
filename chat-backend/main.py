import os
import yaml
from pathlib import Path
from openai import AzureOpenAI
from fastapi import FastAPI, Response, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        # The path to your .env file
        env_file=".env",
        # The encoding to use for the .env file
        env_file_encoding='utf-8'
    )

    allow_origins: list[str] = Field(alias="ALLOW_ORIGINS", default=["http://localhost:5173"])
    openai_endpoint: str = Field(alias="AZ_OPENAI_ENDPOINT")
    openai_api_key: str = Field(alias="AZ_OPENAI_API_KEY")
    ai_search_endpoint: str = Field(alias="AZ_AI_SEARCH_ENDPOINT")
    ai_search_api_key: str = Field(alias="AZ_AI_SEARCH_API_KEY")
    ai_search_index_name: str = Field(alias="AZ_AI_SEARCH_INDEX_NAME")
    embedding_model_name: str = Field(alias="EMBEDDING_MODEL_NAME")
    chat_model_name: str = Field(alias="CHAT_MODEL_NAME")
    system_prompt: str = Field(default="You are a helpful assistant that answers questions using provided context.")

    @field_validator("allow_origins", mode="before")
    @classmethod
    def parse_allow_origins(cls, v):
        """Parse comma-separated CORS origins from env var or default."""
        if v and isinstance(v, list):
            # Split by comma and strip whitespace
            return v
        
        return cls.model_fields["allow_origins"].default

    @field_validator("system_prompt", mode="before")
    @classmethod
    def load_system_prompt(cls, v):
        """Load system prompt from env var, config file, or use default."""
        # If explicitly set, use it
        if v and v != cls.model_fields["system_prompt"].default:
            return v
        
        # Check for env var override
        env_val = os.getenv("SYSTEM_PROMPT")
        if env_val:
            return env_val
        
        # Load from config/prompts.yaml
        config_path = Path(__file__).parent / "config" / "prompts.yaml"
        if config_path.exists():
            try:
                with open(config_path, "r") as f:
                    config = yaml.safe_load(f)
                    return config["system_prompts"]["rag_assistant"]["content"].strip()
            except Exception:
                pass
        
        # Use default
        return cls.model_fields["system_prompt"].default

settings = Settings()
print(settings)

# Get an Azure OpenAI chat client
chat_client = AzureOpenAI(
    api_version = "2024-12-01-preview",
    azure_endpoint = settings.openai_endpoint,
    api_key = settings.openai_api_key
)

# Initialize prompt with system message (loaded via Settings validator)
prompt = [{"role": "system", "content": settings.system_prompt}]

# Additional parameters to apply RAG pattern using the AI Search index
rag_params = {
    "data_sources": [
        {
            "type": "azure_search",
            "parameters": {
                "endpoint": settings.ai_search_endpoint,
                "index_name": settings.ai_search_index_name,
                "authentication": {
                    "type": "api_key",
                    "key": settings.ai_search_api_key,
                },
                # Params for vector-based query
                "query_type": "vector",
                "embedding_dependency": {
                    "type": "deployment_name",
                    "deployment_name": settings.embedding_model_name,
                },
            }
        }
    ],
}


app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.allow_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class Context(BaseModel):
    prompt: str


@app.get("/health")
async def health():
    """Health check endpoint for container orchestration."""
    return "OK"


@app.post("/chat")
async def chat(ctx: Context, response: Response):
    prompt.append({"role": "user", "content": ctx.prompt})

    def gen_response():
        try:
            completion = chat_client.chat.completions.create(
                model=settings.chat_model_name,
                messages=prompt,
                extra_body=rag_params,
                temperature=0,
                stream=True
            )
            for chunk in completion:
                if chunk.choices and chunk.choices[0].delta.content is not None:
                    yield chunk.choices[0].delta.content
        except Exception:
            response.status_code = status.HTTP_503_SERVICE_UNAVAILABLE
            return

    return StreamingResponse(gen_response(), media_type="text/plain")