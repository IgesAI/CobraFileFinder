import pytest
from app import app

@pytest.fixture
def client():
    app.config['TESTING'] = True
    with app.test_client() as client:
        yield client

def test_search_endpoint(client):
    response = client.post('/api/search', json={
        'category': 'motorcycle',
        'searchTerm': 'test'
    })
    assert response.status_code == 200
    data = response.get_json()
    assert 'results' in data 