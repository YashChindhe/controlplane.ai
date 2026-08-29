import os
from typing import Optional, Union
from openai import OpenAI, AsyncOpenAI

class Client(OpenAI):
    """
    ControlPlane Client - acts as a drop-in replacement wrapper for openai.OpenAI
    intercepting calls and routing them through ControlPlane Tri-Guard Gateway.
    """
    def __init__(
        self,
        api_key: Optional[str] = None,
        base_url: Optional[str] = None,
        **kwargs
    ) -> None:
        # Retrieve configuration values with defaults matching ControlPlane environment
        cp_api_key = api_key or os.environ.get("CONTROLPLANE_API_KEY")
        cp_base_url = base_url or os.environ.get("CONTROLPLANE_GATEWAY_URL") or "http://localhost:3000/v1"

        if not cp_api_key:
            raise ValueError(
                "Missing ControlPlane API key. Please specify api_key or set the "
                "CONTROLPLANE_API_KEY environment variable."
            )

        # Build custom headers containing the ControlPlane client identifier
        default_headers = kwargs.pop("default_headers", {})
        default_headers["x-api-key"] = cp_api_key
        
        # Call superclass init targeting the proxy Gateway
        super().__init__(
            api_key=cp_api_key,
            base_url=cp_base_url,
            default_headers=default_headers,
            **kwargs
        )


class AsyncClient(AsyncOpenAI):
    """
    ControlPlane AsyncClient - acts as a drop-in replacement wrapper for openai.AsyncOpenAI
    intercepting calls and routing them through ControlPlane Tri-Guard Gateway.
    """
    def __init__(
        self,
        api_key: Optional[str] = None,
        base_url: Optional[str] = None,
        **kwargs
    ) -> None:
        # Retrieve configuration values with defaults matching ControlPlane environment
        cp_api_key = api_key or os.environ.get("CONTROLPLANE_API_KEY")
        cp_base_url = base_url or os.environ.get("CONTROLPLANE_GATEWAY_URL") or "http://localhost:3000/v1"

        if not cp_api_key:
            raise ValueError(
                "Missing ControlPlane API key. Please specify api_key or set the "
                "CONTROLPLANE_API_KEY environment variable."
            )

        # Build custom headers containing the ControlPlane client identifier
        default_headers = kwargs.pop("default_headers", {})
        default_headers["x-api-key"] = cp_api_key

        # Call superclass init targeting the proxy Gateway
        super().__init__(
            api_key=cp_api_key,
            base_url=cp_base_url,
            default_headers=default_headers,
            **kwargs
        )
