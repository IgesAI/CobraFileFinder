import pytest
import os
import tempfile
from app import app, VALID_EXTENSIONS

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
    assert 'stats' in data

def test_valid_extensions():
    # Test that STEP files are included in valid extensions
    assert '.step' in VALID_EXTENSIONS
    assert '.stp' in VALID_EXTENSIONS
    assert '.stl' in VALID_EXTENSIONS
    assert '.3mf' in VALID_EXTENSIONS

def test_health_endpoint(client):
    response = client.get('/api/health')
    assert response.status_code == 200
    data = response.get_json()
    assert 'status' in data
    assert 'drives_ok' in data

def test_file_type_filter():
    # Create a mock function to test file type filtering
    from app import process_directory
    
    # Create temporary test files
    with tempfile.TemporaryDirectory() as temp_dir:
        # Create test files
        test_files = [
            'test1.stl',
            'test2.3mf',
            'test3.step',
            'test4.stp',
            'test5.txt'  # Should be ignored
        ]
        
        for file_name in test_files:
            with open(os.path.join(temp_dir, file_name), 'w') as f:
                f.write('test content')
        
        # Test with no file type filter
        results = process_directory(temp_dir, ['test'], None, temp_dir)
        assert len(results) == 4  # Should find all 4 valid files
        
        # Test with STL filter
        results = process_directory(temp_dir, ['test'], 'stl', temp_dir)
        assert len(results) == 1
        assert results[0]['name'] == 'test1.stl'
        
        # Test with STEP filter
        results = process_directory(temp_dir, ['test'], 'step', temp_dir)
        assert len(results) == 1
        assert results[0]['name'] == 'test3.step' 