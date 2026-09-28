import sys
sys.path.insert(0, '.')
from app.core.config import get_settings
s = get_settings()
print("LLM_PROVIDER:", s.llm_provider)
print("LLM_MODEL:", s.llm_model)
print("OPENAI_KEY_SET:", bool(s.openai_api_key and s.openai_api_key != 'your-openai-api-key-here'))
print("OPENAI_KEY_VALUE:", s.openai_api_key[:20] + "..." if s.openai_api_key else "None")
print("GEMINI_KEY_SET:", bool(s.gemini_api_key))
print("ANTHROPIC_KEY_SET:", bool(s.anthropic_api_key))
print("HINDSIGHT_URL:", s.hindsight_base_url)
print("HINDSIGHT_BANK_ID:", s.hindsight_bank_id)
print("HINDSIGHT_KEY_SET:", bool(s.hindsight_api_key))
