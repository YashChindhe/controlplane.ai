import os
import pytest
from unittest.mock import patch, MagicMock
from controlplane import Client, AsyncClient

def test_client_initialization_with_env():
    with patch.dict(os.environ, {"CONTROLPLANE_API_KEY": "cp_test_tenant_xyz"}):
        client = Client()
        assert client.api_key == "cp_test_tenant_xyz"
        assert client.base_url == "http://localhost:3000/v1/"
        assert client.headers["x-api-key"] == "cp_test_tenant_xyz"

def test_client_missing_api_key():
    with patch.dict(os.environ, {}, clear=True):
        with pytest.raises(ValueError, match="Missing ControlPlane API key"):
            Client()

def test_client_custom_init():
    client = Client(api_key="cp_test_tenant_custom", base_url="http://custom-gateway:4000/v1")
    assert client.api_key == "cp_test_tenant_custom"
    assert client.base_url == "http://custom-gateway:4000/v1/"
    assert client.headers["x-api-key"] == "cp_test_tenant_custom"
